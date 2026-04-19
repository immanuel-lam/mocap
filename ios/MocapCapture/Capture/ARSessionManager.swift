import ARKit
import Foundation

/// Manages an ARSession and translates ARKit frames into PoseSamples.
/// Callbacks are dispatched on a background queue; callers must handle thread safety.
final class ARSessionManager: NSObject, ARSessionDelegate, ObservableObject {

    let session = ARSession()

    /// Called on ARKit's internal queue for every tracked frame.
    var onPoseSample: ((Double, PoseSample) -> Void)?   // (rawTimestamp, sample)

    // MARK: - Lifecycle

    func start() {
        let config = ARWorldTrackingConfiguration()
        config.planeDetection = []                  // no plane detection — saves battery
        config.isLightEstimationEnabled = false
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func stop() {
        session.pause()
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard let onPoseSample else { return }

        let transform = frame.camera.transform

        // Position from column 3 of the camera transform
        let px = Double(transform.columns.3.x)
        let py = Double(transform.columns.3.y)
        let pz = Double(transform.columns.3.z)

        // Rotation: extract 3×3 upper-left, convert to quaternion
        let rot = simd_float3x3(
            SIMD3(transform.columns.0.x, transform.columns.0.y, transform.columns.0.z),
            SIMD3(transform.columns.1.x, transform.columns.1.y, transform.columns.1.z),
            SIMD3(transform.columns.2.x, transform.columns.2.y, transform.columns.2.z)
        )
        let q = simd_quatf(rot)

        let sample = PoseSample(
            t: 0,   // will be filled in by SessionRecorder
            p: [px, py, pz],
            q: [Double(q.imag.x), Double(q.imag.y), Double(q.imag.z), Double(q.real)],
            tracking: trackingState(from: frame.camera.trackingState),
            trackingReason: trackingReason(from: frame.camera.trackingState)
        )

        onPoseSample(frame.timestamp, sample)
    }

    // MARK: - Helpers

    private func trackingState(from state: ARCamera.TrackingState) -> PoseSample.TrackingState {
        switch state {
        case .normal:        return .normal
        case .limited:       return .limited
        case .notAvailable:  return .notAvailable
        @unknown default:    return .notAvailable
        }
    }

    private func trackingReason(from state: ARCamera.TrackingState) -> PoseSample.TrackingReason? {
        guard case .limited(let reason) = state else { return nil }
        switch reason {
        case .initializing:         return .initializing
        case .relocalizing:         return .relocalizing
        case .excessiveMotion:      return .excessiveMotion
        case .insufficientFeatures: return .insufficientFeatures
        @unknown default:           return nil
        }
    }
}
