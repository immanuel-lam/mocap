import ARKit
import SceneKit
import SwiftUI

/// UIViewRepresentable wrapping ARSCNView for the camera feed.
struct ARContainerView: UIViewRepresentable {
    let session: ARSession

    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView(frame: .zero)
        view.session = session
        view.scene = SCNScene()                   // empty scene — just camera feed
        view.automaticallyUpdatesLighting = false
        view.rendersContinuously = true
        view.showsStatistics = false
        return view
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}

/// UIViewRepresentable wrapping TouchOverlayView.
struct TouchOverlayWrapper: UIViewRepresentable {
    var onTouchEvent: (TouchEvent) -> Void

    func makeUIView(context: Context) -> TouchOverlayView {
        let view = TouchOverlayView()
        view.onTouchEvent = onTouchEvent
        return view
    }

    func updateUIView(_ uiView: TouchOverlayView, context: Context) {
        uiView.onTouchEvent = onTouchEvent
    }
}
