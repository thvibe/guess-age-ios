import Foundation
import SwiftUI

/// Drives the endless solo game: maintains a shuffled queue of photos, builds
/// the four options per round, tracks score/streak, and reveals the answer.
@MainActor
final class GameViewModel: ObservableObject {

    // MARK: Round state

    /// The photo currently being guessed.
    @Published private(set) var current: AgePhoto?
    /// The four options for the current photo.
    @Published private(set) var options: AgeOptionGenerator.Options?
    /// The option the player tapped, if any (drives reveal styling).
    @Published private(set) var selectedIndex: Int?
    /// True once the player has answered the current photo.
    @Published private(set) var hasAnswered = false

    // MARK: Score

    @Published private(set) var score = 0
    @Published private(set) var rounds = 0
    @Published private(set) var correctCount = 0
    @Published private(set) var streak = 0
    @Published private(set) var bestStreak = 0

    var accuracy: Double {
        rounds == 0 ? 0 : Double(correctCount) / Double(rounds)
    }

    var isCorrect: Bool {
        guard let selectedIndex, let options else { return false }
        return selectedIndex == options.correctIndex
    }

    /// Which kind of image this game shows.
    let mode: FaceStyle

    /// Age range for generated cartoon faces (includes children).
    private let cartoonAgeRange = 3...85

    private let store: DataStore
    private var queue: [AgePhoto] = []

    init(store: DataStore, mode: FaceStyle = .photo) {
        self.store = store
        self.mode = mode
        start()
    }

    /// (Re)start a fresh game.
    func start() {
        score = 0; rounds = 0; correctCount = 0; streak = 0; bestStreak = 0
        queue = mode == .cartoon ? [] : store.photos.shuffled()
        advance()
    }

    /// A fresh randomly-aged cartoon person. Cartoon mode is endless by
    /// generation, so it needs no dataset and works fully offline.
    private func makeCartoonPhoto() -> AgePhoto {
        AgePhoto(id: "cartoon-\(UInt32.random(in: .min ... .max))",
                 age: Int.random(in: cartoonAgeRange))
    }

    /// Register the player's tap. No-op once already answered.
    func select(_ index: Int) {
        guard !hasAnswered, let options, options.values.indices.contains(index) else { return }
        selectedIndex = index
        hasAnswered = true
        rounds += 1
        if index == options.correctIndex {
            correctCount += 1
            streak += 1
            bestStreak = max(bestStreak, streak)
            // Bonus points for sustained streaks keep "just keep playing" rewarding.
            score += 10 + min(streak - 1, 10)
        } else {
            streak = 0
        }
    }

    /// Move to the next face.
    func advance() {
        selectedIndex = nil
        hasAnswered = false

        let next: AgePhoto?
        if mode == .cartoon {
            next = makeCartoonPhoto()
        } else {
            refillIfNeeded()
            next = queue.first
            if next != nil { queue.removeFirst() }
        }

        guard let photo = next else {
            current = nil
            options = nil
            return
        }
        current = photo
        options = AgeOptionGenerator.makeOptions(trueAge: photo.age)
    }

    /// Endless loop: when the queue runs low, reshuffle the full known pool
    /// (which may have grown via the streamed manifest) back in.
    private func refillIfNeeded() {
        guard queue.count <= AppConfig.refillThreshold, !store.photos.isEmpty else { return }
        let currentID = current?.id
        var refill = store.photos.shuffled()
        // Avoid showing the same photo twice in a row across the seam.
        if let currentID, refill.first?.id == currentID, refill.count > 1 {
            refill.swapAt(0, 1)
        }
        queue.append(contentsOf: refill)
    }
}
