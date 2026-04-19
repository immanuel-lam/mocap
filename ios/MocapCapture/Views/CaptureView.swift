import SwiftUI

struct CaptureView: View {
    @StateObject private var recorder  = SessionRecorder()
    @StateObject private var arManager = ARSessionManager()
    @StateObject private var sensors   = SensorManager()
    @StateObject private var wsClient  = WebSocketClient()

    @AppStorage("serverURL") private var serverURLString = ""
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var markerLabelInput = ""
    @State private var showMarkerAlert = false

    var body: some View {
        ZStack {
            // AR camera preview fills the screen
            ARContainerView(session: arManager.session)
                .ignoresSafeArea()

            // Touch capture overlay (transparent, passes events through)
            TouchOverlayWrapper { event in
                recorder.addTouch(rawTimestamp: event.t, event: event)
            }
            .ignoresSafeArea()

            // HUD
            VStack(spacing: 0) {
                topBar
                Spacer()
                bottomBar
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .onAppear(perform: wireUp)
        .onDisappear {
            arManager.stop()
            sensors.stop()
            wsClient.disconnect()
        }
        .alert("Add Marker", isPresented: $showMarkerAlert) {
            TextField("Label (optional)", text: $markerLabelInput)
            Button("Add") {
                recorder.addMarker(label: markerLabelInput.isEmpty ? nil : markerLabelInput)
                markerLabelInput = ""
            }
            Button("Cancel", role: .cancel) { markerLabelInput = "" }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = shareURL {
                ShareSheet(url: url)
            }
        }
    }

    // MARK: - Sub-views

    private var topBar: some View {
        HStack {
            trackingBadge
            Spacer()
            connectionBadge
        }
        .padding(.top, 8)
    }

    private var trackingBadge: some View {
        Text(recorder.trackingLabel)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(trackingColor.opacity(0.85))
            .foregroundStyle(.white)
            .clipShape(Capsule())
    }

    private var trackingColor: Color {
        switch recorder.trackingLabel {
        case "Normal": return .green
        case "Limited": return .orange
        default: return .red
        }
    }

    private var connectionBadge: some View {
        Text(wsClient.isConnected ? "● Live" : "○ Offline")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(wsClient.isConnected ? .green : .secondary)
    }

    private var statsRow: some View {
        HStack(spacing: 20) {
            statLabel("Pose", count: recorder.poseCount)
            statLabel("IMU",  count: recorder.imuCount)
            statLabel("Touch",count: recorder.touchCount)
            statLabel("Markers", count: recorder.markerCount)
        }
        .font(.caption.monospacedDigit())
        .padding(8)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func statLabel(_ name: String, count: Int) -> some View {
        VStack(spacing: 2) {
            Text(name).foregroundStyle(.secondary)
            Text("\(count)").bold()
        }
    }

    private var elapsedLabel: some View {
        Text(formatMs(recorder.elapsedMs))
            .font(.system(.title2, design: .monospaced).weight(.semibold))
            .foregroundStyle(.white)
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            statsRow
            elapsedLabel

            HStack(spacing: 24) {
                // Marker button
                Button {
                    showMarkerAlert = true
                } label: {
                    Image(systemName: "flag.fill")
                        .font(.title2)
                        .foregroundStyle(.yellow)
                }
                .disabled(!recorder.isRecording)

                // Record / Stop button
                Button(action: toggleRecording) {
                    Circle()
                        .fill(recorder.isRecording ? Color.red : Color.white)
                        .frame(width: 72, height: 72)
                        .overlay {
                            if recorder.isRecording {
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(.white)
                                    .frame(width: 28, height: 28)
                            }
                        }
                        .shadow(color: .black.opacity(0.4), radius: 8)
                }

                // Share last session
                Button {
                    if let url = shareURL { showShareSheet = true }
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.title2)
                        .foregroundStyle(shareURL != nil ? .white : .secondary)
                }
                .disabled(shareURL == nil)
            }
            .padding(.bottom, 16)
        }
    }

    // MARK: - Actions

    private func wireUp() {
        arManager.onPoseSample = { rawT, sample in
            recorder.addPose(rawTimestamp: rawT, sample: sample)
        }
        sensors.onImuSample = { rawT, sample in
            recorder.addImu(rawTimestamp: rawT, sample: sample)
        }
        wsClient.recorder = recorder
        arManager.start()
        sensors.start()

        if let url = URL(string: serverURLString), !serverURLString.isEmpty {
            // will connect when recording starts
        }
    }

    private func toggleRecording() {
        if recorder.isRecording {
            guard let session = recorder.stop() else { return }
            saveAndUpload(session)
        } else {
            let sessionId = UUID().uuidString
            recorder.start()
            if let serverURL = URL(string: serverURLString), !serverURLString.isEmpty {
                if let wsURL = URL(string: serverURLString.replacingOccurrences(of: "http", with: "ws") + "/ws") {
                    wsClient.connect(to: wsURL, sessionId: sessionId)
                }
            }
        }
    }

    private func saveAndUpload(_ session: Session) {
        Task {
            guard let data = try? SessionEncoder.encode(session) else { return }
            if let url = try? SessionStore.save(session: session, data: data) {
                await MainActor.run { shareURL = url }
            }
            if let serverURL = URL(string: serverURLString), !serverURLString.isEmpty {
                try? await Uploader.upload(session: session, data: data, to: serverURL)
            }
            wsClient.disconnect()
        }
    }

    private func formatMs(_ ms: Double) -> String {
        let totalS = Int(ms / 1000)
        let min = totalS / 60
        let sec = totalS % 60
        let frac = Int((ms.truncatingRemainder(dividingBy: 1000)) / 100)
        return String(format: "%02d:%02d.%d", min, sec, frac)
    }
}

// MARK: - ShareSheet

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
