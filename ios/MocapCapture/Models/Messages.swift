import Foundation

// MARK: - Outbound (iOS → server)

struct IdentifyMessage: Encodable {
    let type = "identify"
    let role = "capture"
    let sessionId: String
}

struct BatchMessage: Encodable {
    let type = "batch"
    let sessionId: String
    let pose: [PoseSample]?
    let imu: [ImuSample]?
    let touches: [TouchEvent]?
}

struct PingMessage: Encodable {
    let type = "ping"
}

// MARK: - Inbound (server → iOS)

struct IncomingMessage: Decodable {
    let type: String
}
