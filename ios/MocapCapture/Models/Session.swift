import Foundation

// MARK: - Top-level session

struct Session: Codable {
    let version: Int
    let id: String
    let createdAt: String
    let device: DeviceInfo
    var pose: [PoseSample]
    var imu: [ImuSample]
    var touches: [TouchEvent]
    var markers: [Marker]
    var video: VideoInfo?
    var mesh: MeshInfo?
    var duration: Double   // ms
}

// MARK: - Device

struct DeviceInfo: Codable {
    let model: String
    let iosVersion: String
    let hasLiDAR: Bool
    let screen: ScreenInfo

    struct ScreenInfo: Codable {
        let width: Double
        let height: Double
        let scale: Double
    }
}

// MARK: - Pose

struct PoseSample: Codable {
    let t: Double           // ms from session start
    let p: [Double]         // [x, y, z] meters, ARKit frame
    let q: [Double]         // [x, y, z, w]
    let tracking: TrackingState
    let trackingReason: TrackingReason?

    enum TrackingState: String, Codable {
        case normal
        case limited
        case notAvailable
    }

    enum TrackingReason: String, Codable {
        case initializing
        case relocalizing
        case excessiveMotion
        case insufficientFeatures
    }
}

// MARK: - IMU

struct ImuSample: Codable {
    let t: Double           // ms from session start
    let a: [Double]         // full accel incl. gravity, m/s²
    let ua: [Double]        // user accel (gravity removed), m/s²
    let rr: [Double]        // rotation rate, rad/s
    let qi: [Double]        // attitude quaternion [x, y, z, w]
    let mag: [Double]?      // magnetometer μT (optional)
}

// MARK: - Touch

struct TouchEvent: Codable {
    let t: Double
    let kind: TouchKind
    let id: Int
    let x: Double           // 0..1 normalized
    let y: Double           // 0..1 normalized
    let force: Double?

    enum TouchKind: String, Codable {
        case start
        case move
        case end
    }
}

// MARK: - Marker

struct Marker: Codable {
    let t: Double
    let label: String
}

// MARK: - Optional media

struct VideoInfo: Codable {
    let filename: String
    let startOffsetMs: Double
    let fps: Double
    let codec: VideoCodec
    let width: Int
    let height: Int

    enum VideoCodec: String, Codable {
        case h264
        case hevc
    }
}

struct MeshInfo: Codable {
    let filename: String
}
