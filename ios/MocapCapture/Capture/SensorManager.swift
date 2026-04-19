import CoreMotion
import Foundation

/// Wraps CMMotionManager and delivers ImuSamples at ~100 Hz.
/// Callbacks are dispatched on a dedicated OperationQueue (not main).
final class SensorManager: ObservableObject {

    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()

    /// Called on the sensor queue for every motion update.
    var onImuSample: ((Double, ImuSample) -> Void)?     // (rawTimestamp, sample)

    var isAvailable: Bool { motionManager.isDeviceMotionAvailable }

    // MARK: - Lifecycle

    func start() {
        guard isAvailable else { return }
        queue.name = "mocap.sensor"
        queue.qualityOfService = .userInteractive

        motionManager.deviceMotionUpdateInterval = 1.0 / 100.0
        motionManager.startDeviceMotionUpdates(
            using: .xArbitraryZVertical,
            to: queue
        ) { [weak self] motion, _ in
            guard let self, let motion, let onImuSample else { return }

            let a  = motion.gravity
            let ua = motion.userAcceleration
            let rr = motion.rotationRate
            let at = motion.attitude.quaternion     // CMQuaternion

            // Full accel = userAccel + gravity (both in m/s²; CMMotionManager provides g-units for gravity)
            // gravity is in g-units (1 g ≈ 9.81 m/s²)
            let g = 9.80665
            let sample = ImuSample(
                t: 0,   // filled by SessionRecorder
                a:  [ua.x * g + a.x * g, ua.y * g + a.y * g, ua.z * g + a.z * g],
                ua: [ua.x * g, ua.y * g, ua.z * g],
                rr: [rr.x, rr.y, rr.z],
                qi: [at.x, at.y, at.z, at.w],
                mag: nil
            )

            onImuSample(motion.timestamp, sample)
        }
    }

    func stop() {
        motionManager.stopDeviceMotionUpdates()
    }
}
