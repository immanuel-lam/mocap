import Foundation

/// URLSessionWebSocketTask-based client.
/// Identifies as `capture` only after the WebSocket handshake completes (via delegate).
@MainActor
final class WebSocketClient: NSObject, URLSessionWebSocketDelegate, ObservableObject {

    @Published private(set) var isConnected = false
    @Published private(set) var statusText = "Disconnected"

    private var task: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var pingTimer: Timer?
    private var batchTimer: Timer?
    private var sessionId: String = ""

    weak var recorder: SessionRecorder?

    // MARK: - Connect / Disconnect

    func connect(to url: URL, sessionId: String) {
        self.sessionId = sessionId
        disconnect()

        // Delegate queue = main so delegate callbacks arrive on main actor
        let config = URLSessionConfiguration.default
        let session = URLSession(configuration: config, delegate: self, delegateQueue: .main)
        urlSession = session
        task = session.webSocketTask(with: url)
        task?.resume()

        receiveLoop()
        startPingTimer()
        startBatchTimer()

        statusText = "Connecting…"
    }

    func disconnect() {
        batchTimer?.invalidate(); batchTimer = nil
        pingTimer?.invalidate(); pingTimer = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnected = false
        statusText = "Disconnected"
    }

    // MARK: - URLSessionWebSocketDelegate

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            isConnected = true
            statusText = "Connected"
            // Identify AFTER handshake — this is the key fix
            send(IdentifyMessage(sessionId: sessionId))
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            isConnected = false
            statusText = "Disconnected (code \(closeCode.rawValue))"
        }
    }

    // MARK: - Private

    private func receiveLoop() {
        task?.receive { [weak self] result in
            switch result {
            case .success:
                Task { @MainActor [weak self] in self?.receiveLoop() }
            case .failure(let err):
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    isConnected = false
                    statusText = "Disconnected: \(err.localizedDescription)"
                }
            }
        }
    }

    private func send<T: Encodable>(_ value: T) {
        guard let task, task.state == .running else { return }
        guard let data = try? JSONEncoder().encode(value),
              let str = String(data: data, encoding: .utf8) else { return }
        task.send(.string(str)) { _ in }
    }

    private func startPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: 10, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.send(PingMessage()) }
        }
    }

    private func startBatchTimer() {
        batchTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.flushBatch() }
        }
    }

    private func flushBatch() {
        guard let recorder, isConnected else { return }
        let (poses, imus, touches) = recorder.drainBatch()
        guard !poses.isEmpty || !imus.isEmpty || !touches.isEmpty else { return }
        send(BatchMessage(
            sessionId: sessionId,
            pose:    poses.isEmpty   ? nil : poses,
            imu:     imus.isEmpty    ? nil : imus,
            touches: touches.isEmpty ? nil : touches
        ))
    }
}
