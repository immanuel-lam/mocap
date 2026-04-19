import Foundation
import UIKit

/// Orchestrates all capture sources into a single session buffer.
/// Thread-safe via an internal serial queue. Published UI state updated on main thread.
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

    // All fields below are ONLY accessed on recorderQueue
    private var poses: [PoseSample] = []
    private var imus: [ImuSample] = []
    private var touches: [TouchEvent] = []
    private var markers: [Marker] = []
    private var pendingPoses: [PoseSample] = []
    private var pendingImus: [ImuSample] = []
    private var pendingTouches: [TouchEvent] = []
    private var startTimestamp: CFTimeInterval = 0
    private var sessionId: String = ""
    private var markerCounter = 0
    /// Shadow of isRecording, safe to read on recorderQueue without crossing actor boundary.
    private var _isRunning = false

    private var elapsedTimer: Timer?

    // MARK: - Start / Stop

    func start() {
        let id = UUID().uuidString
        let now = ProcessInfo.processInfo.systemUptime
        recorderQueue.async {
            self.sessionId = id
            self.startTimestamp = now
            self.poses = []
            self.imus = []
            self.touches = []
            self.markers = []
            self.pendingPoses = []
            self.pendingImus = []
            self.pendingTouches = []
            self.markerCounter = 0
            self._isRunning = true
        }
        Task { @MainActor in
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
                pose: poses,
                imu: imus,
                touches: touches,
                markers: markers,
                video: nil,
                mesh: nil,
                duration: duration
            )
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
            let s = PoseSample(t: tMs, p: sample.p, q: sample.q, tracking: sample.tracking, trackingReason: sample.trackingReason)
            poses.append(s)
            pendingPoses.append(s)
            let count = poses.count
            let label: String
            switch s.tracking {
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
            let s = ImuSample(t: tMs, a: sample.a, ua: sample.ua, rr: sample.rr, qi: sample.qi, mag: sample.mag)
            imus.append(s)
            pendingImus.append(s)
            let count = imus.count
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

    // MARK: - Elapsed timer

    private func startElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self, isRecording else { return }
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.elapsedMs = (ProcessInfo.processInfo.systemUptime - startTimestamp) * 1000
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
