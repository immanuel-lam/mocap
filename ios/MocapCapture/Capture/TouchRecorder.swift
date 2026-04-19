import UIKit

/// Transparent UIView overlaid on top of the AR view.
/// Captures multi-touch events without blocking them.
final class TouchOverlayView: UIView {

    /// Called on main queue for every touch phase.
    var onTouchEvent: ((TouchEvent) -> Void)?

    // MARK: - Init

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isUserInteractionEnabled = true
        isMultipleTouchEnabled = true
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: - UIResponder

    override func touchesBegan(_ touches: Set<UITouch>, with _: UIEvent?) {
        emit(touches, kind: .start)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with _: UIEvent?) {
        emit(touches, kind: .move)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with _: UIEvent?) {
        emit(touches, kind: .end)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with _: UIEvent?) {
        emit(touches, kind: .end)
    }

    // MARK: - Hit test — let touches pass through to views below

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }

    // MARK: - Helpers

    private func emit(_ touches: Set<UITouch>, kind: TouchEvent.TouchKind) {
        guard let onTouchEvent, bounds.width > 0, bounds.height > 0 else { return }
        let t = ProcessInfo.processInfo.systemUptime   // will be normalized by recorder
        for touch in touches {
            let loc = touch.location(in: self)
            let event = TouchEvent(
                t: t,
                kind: kind,
                id: touch.hash,
                x: Double(loc.x / bounds.width),
                y: Double(loc.y / bounds.height),
                force: touch.maximumPossibleForce > 0
                    ? Double(touch.force / touch.maximumPossibleForce)
                    : nil
            )
            onTouchEvent(event)
        }
    }
}
