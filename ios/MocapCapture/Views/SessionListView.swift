import SwiftUI

struct SessionListView: View {
    @State private var sessions: [(id: String, date: String, poseCount: Int)] = []
    @State private var error: String?
    @State private var showShareSheet = false
    @State private var shareURL: URL?

    var body: some View {
        NavigationStack {
            Group {
                if sessions.isEmpty {
                    ContentUnavailableView("No Sessions", systemImage: "waveform", description: Text("Record a session to see it here."))
                } else {
                    List {
                        ForEach(sessions, id: \.id) { s in
                            sessionRow(s)
                        }
                        .onDelete(perform: deleteSessions)
                    }
                }
            }
            .navigationTitle("Sessions")
            .toolbar {
                EditButton()
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showShareSheet) {
            if let url = shareURL { ShareSheet(url: url) }
        }
    }

    private func sessionRow(_ s: (id: String, date: String, poseCount: Int)) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(s.id.prefix(8))
                    .font(.headline.monospacedDigit())
                Text(s.date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(s.poseCount) pose samples")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                let dir = SessionStore.sessionsURL.appendingPathComponent(s.id)
                let url = dir.appendingPathComponent("session.json")
                shareURL = url
                showShareSheet = true
            } label: {
                Image(systemName: "square.and.arrow.up")
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 4)
    }

    private func reload() {
        let ids = SessionStore.listIDs()
        sessions = ids.compactMap { id in
            guard let (session, _) = try? SessionStore.load(id: id) else { return nil }
            return (id: id, date: session.createdAt, poseCount: session.pose.count)
        }.sorted { $0.date > $1.date }
    }

    private func deleteSessions(at offsets: IndexSet) {
        for i in offsets {
            try? SessionStore.delete(id: sessions[i].id)
        }
        sessions.remove(atOffsets: offsets)
    }
}
