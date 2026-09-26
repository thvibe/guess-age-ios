import SwiftUI

/// One of the four tappable age options. Styling reflects the reveal state:
/// neutral before answering, then green for the correct age and red for a
/// wrong pick.
struct AnswerButton: View {
    let age: Int
    let state: State
    let action: () -> Void

    enum State {
        case idle          // not answered yet
        case correct       // this is the right answer (shown after answering)
        case wrongSelected // the player tapped this and it was wrong
        case dimmed        // answered, but this isn't relevant
    }

    var body: some View {
        Button(action: action) {
            Text("\(age)")
                .font(.system(size: 34, weight: .bold, design: .rounded))
                .monospacedDigit()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 22)
                .background(background)
                .foregroundStyle(foreground)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(border, lineWidth: 2)
                )
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.2), value: state)
    }

    private var background: Color {
        switch state {
        case .idle: return Color(.secondarySystemBackground)
        case .correct: return Color.green.opacity(0.22)
        case .wrongSelected: return Color.red.opacity(0.22)
        case .dimmed: return Color(.secondarySystemBackground).opacity(0.5)
        }
    }

    private var border: Color {
        switch state {
        case .idle: return Color.primary.opacity(0.12)
        case .correct: return .green
        case .wrongSelected: return .red
        case .dimmed: return Color.primary.opacity(0.06)
        }
    }

    private var foreground: Color {
        switch state {
        case .dimmed: return .secondary
        default: return .primary
        }
    }
}
