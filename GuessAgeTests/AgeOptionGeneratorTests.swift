import XCTest
@testable import GuessAge

final class AgeOptionGeneratorTests: XCTestCase {

    /// A deterministic RNG so option generation is reproducible under test.
    private struct SeededRNG: RandomNumberGenerator {
        var state: UInt64
        init(seed: UInt64) { state = seed == 0 ? 0x9E3779B97F4A7C15 : seed }
        mutating func next() -> UInt64 {
            // xorshift64*
            state ^= state >> 12
            state ^= state << 25
            state ^= state >> 27
            return state &* 0x2545F4914F6CDD1D
        }
    }

    func testAlwaysFourDistinctOptions() {
        for age in AgeOptionGenerator.minAge...AgeOptionGenerator.maxAge {
            var rng = SeededRNG(seed: UInt64(age) + 1)
            let opts = AgeOptionGenerator.makeOptions(trueAge: age, using: &rng)
            XCTAssertEqual(opts.values.count, 4, "age \(age) should yield 4 options")
            XCTAssertEqual(Set(opts.values).count, 4, "age \(age) options must be distinct")
        }
    }

    func testTrueAgeIsPresentAndIndexed() {
        for age in AgeOptionGenerator.minAge...AgeOptionGenerator.maxAge {
            var rng = SeededRNG(seed: UInt64(age) * 7 + 3)
            let opts = AgeOptionGenerator.makeOptions(trueAge: age, using: &rng)
            XCTAssertTrue(opts.values.contains(age), "age \(age) must be among options")
            XCTAssertEqual(opts.correctValue, age, "correctIndex must point at the true age")
        }
    }

    func testOptionsAreSpacedApart() {
        for age in AgeOptionGenerator.minAge...AgeOptionGenerator.maxAge {
            var rng = SeededRNG(seed: UInt64(age) * 17 + 11)
            let opts = AgeOptionGenerator.makeOptions(trueAge: age, using: &rng)
            let sorted = opts.values.sorted()
            for i in 1..<sorted.count {
                XCTAssertGreaterThanOrEqual(
                    sorted[i] - sorted[i-1], AgeOptionGenerator.minOptionGap,
                    "options \(sorted) too close for age \(age)")
            }
        }
    }

    func testOptionsWithinValidRange() {
        for age in AgeOptionGenerator.minAge...AgeOptionGenerator.maxAge {
            var rng = SeededRNG(seed: UInt64(age) * 13 + 5)
            let opts = AgeOptionGenerator.makeOptions(trueAge: age, using: &rng)
            for v in opts.values {
                XCTAssertGreaterThanOrEqual(v, AgeOptionGenerator.minAge)
                XCTAssertLessThanOrEqual(v, AgeOptionGenerator.maxAge)
            }
        }
    }

    func testOutOfRangeInputIsClamped() {
        var rng = SeededRNG(seed: 42)
        let low = AgeOptionGenerator.makeOptions(trueAge: -5, using: &rng)
        XCTAssertTrue(low.values.contains(AgeOptionGenerator.minAge))
        XCTAssertEqual(low.correctValue, AgeOptionGenerator.minAge)

        let high = AgeOptionGenerator.makeOptions(trueAge: 250, using: &rng)
        XCTAssertTrue(high.values.contains(AgeOptionGenerator.maxAge))
        XCTAssertEqual(high.correctValue, AgeOptionGenerator.maxAge)
    }

    func testDeterministicForSameSeed() {
        var a = SeededRNG(seed: 99)
        var b = SeededRNG(seed: 99)
        let oa = AgeOptionGenerator.makeOptions(trueAge: 30, using: &a)
        let ob = AgeOptionGenerator.makeOptions(trueAge: 30, using: &b)
        XCTAssertEqual(oa.values, ob.values)
        XCTAssertEqual(oa.correctIndex, ob.correctIndex)
    }
}
