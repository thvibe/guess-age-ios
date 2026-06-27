import XCTest
@testable import GuessAge

@MainActor
final class GameViewModelTests: XCTestCase {

    private func makeGame(_ ages: [Int] = [20, 35, 50, 65, 80]) -> GameViewModel {
        let photos = ages.enumerated().map { AgePhoto(id: "p\($0.offset)", age: $0.element) }
        return GameViewModel(store: DataStore(photos: photos))
    }

    /// A correct answer always points at the current photo's true age.
    private func correctIndex(_ game: GameViewModel) -> Int {
        game.options!.correctIndex
    }

    private func wrongIndex(_ game: GameViewModel) -> Int {
        let correct = game.options!.correctIndex
        return (correct + 1) % game.options!.values.count
    }

    func testStartsWithAPhotoAndOptions() {
        let game = makeGame()
        XCTAssertNotNil(game.current)
        let options = game.options!
        XCTAssertEqual(options.values.count, 4)
        // The options must include the current photo's real age.
        XCTAssertTrue(options.values.contains(game.current!.age))
        XCTAssertEqual(options.correctValue, game.current!.age)
    }

    func testCorrectAnswerScoresAndAdvancesStreak() {
        let game = makeGame()
        game.select(correctIndex(game))
        XCTAssertTrue(game.hasAnswered)
        XCTAssertTrue(game.isCorrect)
        XCTAssertEqual(game.rounds, 1)
        XCTAssertEqual(game.correctCount, 1)
        XCTAssertEqual(game.streak, 1)
        XCTAssertEqual(game.bestStreak, 1)
        XCTAssertEqual(game.score, 10) // 10 + min(streak-1,10) = 10
    }

    func testStreakBonusGrowsThenResetsOnWrong() {
        let game = makeGame()
        // Three correct in a row: 10, then 11, then 12 -> 33.
        game.select(correctIndex(game)); game.advance()
        game.select(correctIndex(game)); game.advance()
        game.select(correctIndex(game))
        XCTAssertEqual(game.streak, 3)
        XCTAssertEqual(game.bestStreak, 3)
        XCTAssertEqual(game.score, 33)

        // A wrong answer resets the streak but keeps score and best streak.
        game.advance()
        game.select(wrongIndex(game))
        XCTAssertFalse(game.isCorrect)
        XCTAssertEqual(game.streak, 0)
        XCTAssertEqual(game.bestStreak, 3)
        XCTAssertEqual(game.score, 33)
        XCTAssertEqual(game.rounds, 4)
        XCTAssertEqual(game.correctCount, 3)
    }

    func testStreakBonusIsCappedAtTen() {
        let game = makeGame()
        var expected = 0
        for i in 1...13 {
            game.select(correctIndex(game))
            expected += 10 + min(i - 1, 10)
            game.advance()
        }
        XCTAssertEqual(game.streak, 13)
        XCTAssertEqual(game.score, expected)
    }

    func testAccuracyReflectsCorrectOverRounds() {
        let game = makeGame()
        game.select(correctIndex(game)); game.advance()   // correct
        game.select(wrongIndex(game)); game.advance()     // wrong
        game.select(correctIndex(game))                   // correct
        XCTAssertEqual(game.rounds, 3)
        XCTAssertEqual(game.correctCount, 2)
        XCTAssertEqual(game.accuracy, 2.0 / 3.0, accuracy: 0.0001)
    }

    func testAnsweringIsLockedUntilAdvance() {
        let game = makeGame()
        game.select(correctIndex(game))
        let scoreAfterFirst = game.score
        // A second tap on the same photo must be ignored.
        game.select(wrongIndex(game))
        XCTAssertEqual(game.score, scoreAfterFirst)
        XCTAssertEqual(game.rounds, 1)
    }

    func testInvalidIndexIsIgnored() {
        let game = makeGame()
        game.select(99)
        XCTAssertFalse(game.hasAnswered)
        XCTAssertEqual(game.rounds, 0)
    }

    func testGameIsEndless() {
        let game = makeGame([20, 40, 60]) // small pool must still never run dry
        for _ in 0..<200 {
            XCTAssertNotNil(game.current)
            XCTAssertEqual(game.options?.values.count, 4)
            game.select(correctIndex(game))
            game.advance()
        }
        XCTAssertNotNil(game.current)
    }

    func testRestartResetsScore() {
        let game = makeGame()
        game.select(correctIndex(game))
        XCTAssertGreaterThan(game.score, 0)
        game.start()
        XCTAssertEqual(game.score, 0)
        XCTAssertEqual(game.rounds, 0)
        XCTAssertEqual(game.streak, 0)
        XCTAssertFalse(game.hasAnswered)
        XCTAssertNotNil(game.current)
    }
}
