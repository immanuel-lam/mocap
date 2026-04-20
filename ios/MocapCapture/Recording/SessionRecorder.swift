import Foundation
import UIKit

/// Orchestrates all capture sources into a single session buffer.
/// Thread-safe via an internal serial queue. Published UI state updated on main thread.
///
/// Memory strategy: instead of storing [PoseSample] / [ImuSample] (each element
/// allocates multiple [Double] heap arrays), accumulate raw doubles in flat
/// ContiguousArray<Double> buffers — one contiguous allocation for the whole recording.
///
/// Pose stride  = 10 doubles: t, px, py, pz, qx, qy, qz, qw, trackingCode, reasonCode
/// IMU  stride  = 14 doubles: t, ax, ay, az, uax, uay, uaz, rrx, rry, rrz, qix, qiy, qiz, qiw
@MainActor
final class SessionRecorder: ObservableObject {

    // MARK: - Published state (main thread)

    @Published private(set) var isRecording = false
    @Published private(set) var poseCount = 0
    @Published private(set) var imuCount = 0
    @Published private(set) var touchCount = 0
    @Published private(set) var markerCount = 0
    @Published private(set) var elapsedMs: Double = 0
    @Published private(set) var trackingLabel = "Not Available"

    // MARK: - Private (recorderQueue)

    private let recorderQueue = DispatchQueue(label: "mocap.recorder", qos: .userInteractive)

    // Flat double buffers — zero per-sample heap allocations.
    private var poseBuf = ContiguousArray<Double>()   // stride 10
    private var imuBuf  = ContiguousArray<Double>()   // stride 14
    private var touches: [TouchEvent] = []
    private var markers: [Marker] = []
    private var pendingPoses: [PoseSample] = []
    private var pendingImus: [ImuSample] = []
    private var pendingTouches: [TouchEvent] = []
    private var startTimestamp: CFTimeInterval = 0
    private var sessionId: String = ""
    private var markerCounter = 0
    private var _isRunning = false

    // Snapshot of startTimestamp safe to read on main actor for the elapsed timer.
    private var startTimestampMain: CFTimeInterval = 0

    private var elapsedTimer: Timer?

    // MARK: - Start / Stop

    func start() {
        let id = UUID().uuidString
        let now = ProcessInfo.processInfo.systemUptime
        recorderQueue.async {
            self.sessionId = id
            self.startTimestamp = now
            // Pre-allocate ~5 min of capacity to avoid repeated resizing.
            // 60 Hz × 300 s × 10 doubles = 180,000  |  100 Hz × 300 s × 14 = 420,000
            self.poseBuf = ContiguousArray<Double>()
            self.poseBuf.reserveCapacity(180_000)
            self.imuBuf = ContiguousArray<Double>()
            self.imuBuf.reserveCapacity(420_000)
            self.touches = []
            self.markers = []
            self.pendingPoses = []
            self.pendingImus = []
            self.pendingTouches = []
            self.markerCounter = 0
            self._isRunning = true
        }
        Task { @MainActor in
            startTimestampMain = now
            isRecording = true
            poseCount = 0; imuCount = 0; touchCount = 0; markerCount = 0; elapsedMs = 0
            UIApplication.shared.isIdleTimerDisabled = true
            startElapsedTimer()
        }
    }

    func stop() -> Session? {
        guard isRecording else { return nil }

        var result: Session?
        recorderQueue.sync {
            _isRunning = false
            let duration = (ProcessInfo.processInfo.systemUptime - startTimestamp) * 1000
            let device = DeviceInfo(
                model: UIDevice.current.modelName,
                iosVersion: UIDevice.current.systemVersion,
                hasLiDAR: false,
                screen: DeviceInfo.ScreenInfo(
                    width: Double(UIScreen.main.bounds.width),
                    height: Double(UIScreen.main.bounds.height),
                    scale: Double(UIScreen.main.scale)
                )
            )
            result = Session(
                version: 1,
                id: sessionId,
                createdAt: ISO8601DateFormatter().string(from: Date()),
                device: device,
                pose: decodePoses(),
                imu: decodeImus(),
                touches: touches,
                markers: markers,
                video: nil,
                mesh: nil,
                duration: duration
            )
            // Release buffers immediately after decoding.
            poseBuf = []
            imuBuf  = []
        }
        Task { @MainActor in
            isRecording = false
            UIApplication.shared.isIdleTimerDisabled = false
            stopElapsedTimer()
        }
        return result
    }

    // MARK: - Add samples (called from various queues)

    func addPose(rawTimestamp: Double, sample: PoseSample) {
        recorderQueue.async { [weak self] in
            guard let self, _isRunning else { return }
            let tMs = (rawTimestamp - startTimestamp) * 1000
            // Encode tracking state and reason as compact doubles.
            let tc: Double
            switch sample.tracking {
            case .normal:       tc = 0
            case .limited:      tc = 1
            case .notAvailable: tc = 2
            }
            let rc: Double
            switch sample.trackingReason {
            case .none:                 rc = 0
            case .initializing:         rc = 1
            case .relocalizing:         rc = 2
            case .excessiveMotion:      rc = 3
            case .insufficientFeatures: rc = 4
            }
            let p = sample.p; let q = sample.q
            poseBuf.append(contentsOf: [tMs, p[0], p[1], p[2], q[0], q[1], q[2], q[3], tc, rc])
            let s = PoseSample(t: tMs, p: p, q: q, tracking: sample.tracking, trackingReason: sample.trackingReason)
            pendingPoses.append(s)
            let count = poseBuf.count / 10
            let label: String
            switch sample.tracking {
            case .normal:       label = "Normal"
            case .limited:      label = "Limited"
            case .notAvailable: label = "Not Available"
            }
            DispatchQueue.main.async { [weak self] in
                self?.poseCount = count
                self?.trackingLabel = label
            }
        }
    }

    func addImu(rawTimestamp: Double, sample: ImuSample) {
        recorderQueue.async { [weak self] in
            guard let self, _isRunning else { return }
            let tMs = (rawTimestamp - startTimestamp) * 1000
            let a = sample.a; let ua = sample.ua; let rr = sample.rr
            let qi = sample.qi
            imuBuf.append(contentsOf: [
                tMs,
                a[0], a[1], a[2],
                ua[0], ua[1], ua[2],
                rr[0], rr[1], rr[2],
                qi[0], qi[1], qi[2], qi[3]
            ])
            let s = ImuSample(t: tMs, a: a, ua: ua, rr: rr, qi: qi, mag: sample.mag)
            pendingImus.append(s)
            let count = imuBuf.count / 14
            DispatchQueue.main.async { [weak self] in self?.imuCount = count }
        }
    }

    func addTouch(rawTimestamp: Double, event: TouchEvent) {
        recorderQueue.async { [weak self] in
            guard let self, _isRunning else { return }
            let tMs = (rawTimestamp - startTimestamp) * 1000
            let e = TouchEvent(t: tMs, kind: event.kind, id: event.id, x: event.x, y: event.y, force: event.force)
            touches.append(e)
            pendingTouches.append(e)
            let count = touches.count
            DispatchQueue.main.async { [weak self] in self?.touchCount = count }
        }
    }

    func addMarker(label: String? = nil) {
        recorderQueue.async { [weak self] in
            guard let self, _isRunning else { return }
            markerCounter += 1
            let l = label ?? "M\(markerCounter)"
            let tMs = (ProcessInfo.processInfo.systemUptime - startTimestamp) * 1000
            markers.append(Marker(t: tMs, label: l))
            let count = markers.count
            DispatchQueue.main.async { [weak self] in self?.markerCount = count }
        }
    }

    // MARK: - Batch drain (called by WebSocketClient every 16 ms)

    func drainBatch() -> ([PoseSample], [ImuSample], [TouchEvent]) {
        var p: [PoseSample] = []
        var i: [ImuSample] = []
        var t: [TouchEvent] = []
        recorderQueue.sync {
            p = pendingPoses; pendingPoses = []
            i = pendingImus;  pendingImus = []
            t = pendingTouches; pendingTouches = []
        }
        return (p, i, t)
    }

    // MARK: - Buffer decode (called on recorderQueue inside stop())

    private func decodePoses() -> [PoseSample] {
        let count = poseBuf.count / 10
        var result = [PoseSample]()
        result.reserveCapacity(count)
        var i = 0
        while i + 10 <= poseBuf.count {
            let tracking: PoseSample.TrackingState
            switch Int(poseBuf[i + 8]) {
            case 0:  tracking = .normal
            case 1:  tracking = .limited
            default: tracking = .notAvailable
            }
            let reason: PoseSample.TrackingReason?
            switch Int(poseBuf[i + 9]) {
            case 1:  reason = .initializing
            case 2:  reason = .relocalizing
            case 3:  reason = .excessiveMotion
            case 4:  reason = .insufficientFeatures
            default: reason = nil
            }
            result.append(PoseSample(
                t: poseBuf[i],
                p: [poseBuf[i+1], poseBuf[i+2], poseBuf[i+3]],
                q: [poseBuf[i+4], poseBuf[i+5], poseBuf[i+6], poseBuf[i+7]],
                tracking: tracking,
                trackingReason: reason
            ))
            i += 10
        }
        return result
    }

    private func decodeImus() -> [ImuSample] {
        let count = imuBuf.count / 14
        var result = [ImuSample]()
        result.reserveCapacity(count)
        var i = 0
        while i + 14 <= imuBuf.count {
            result.append(ImuSample(
                t:  imuBuf[i],
                a:  [imuBuf[i+1], imuBuf[i+2], imuBuf[i+3]],
                ua: [imuBuf[i+4], imuBuf[i+5], imuBuf[i+6]],
                rr: [imuBuf[i+7], imuBuf[i+8], imuBuf[i+9]],
                qi: [imuBuf[i+10], imuBuf[i+11], imuBuf[i+12], imuBuf[i+13]],
                mag: nil
            ))
            i += 14
        }
        return result
    }

    // MARK: - Elapsed timer

    private func startElapsedTimer() {
        elapsedTimer?.invalidate()
        // Use startTimestampMain (main-actor copy) — no cross-queue read.
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor [weak self] in
                guard let self, isRecording else { return }
                self.elapsedMs = (ProcessInfo.processInfo.systemUptime - self.startTimestampMain) * 1000
            }
        }
    }

    private func stopElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }
}

// MARK: - UIDevice model name helper

extension UIDevice {
    var modelName: String {
        var systemInfo = utsname()
        uname(&systemInfo)
        return withUnsafePointer(to: &systemInfo.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(validatingUTF8: $0) ?? "iPhone" }
        }
    }
}
