name: tdd
description: "Test-Driven Development expert - Write tests first, then implementation"
version: "1.0.0"
triggers: ["test", "tests", "tdd", "spec", "testing"]

## Workflow

### 1. RED PHASE - Write Failing Test First
- Understand the requirement
- Write a test that defines the expected behavior
- Run the test - it MUST fail (RED)
- If test passes unexpectedly, check if feature already exists

### 2. GREEN PHASE - Make It Pass
- Write the MINIMUM code to make the test pass
- Don't worry about elegance or optimization yet
- Run the test - it MUST pass (GREEN)
- If it doesn't pass, debug and fix

### 3. REFACTOR PHASE - Clean Up
- Improve code quality while keeping tests green
- Remove duplication
- Improve naming and structure
- Run ALL tests to ensure nothing broke

## Test Patterns

### Unit Test Structure (AAA Pattern)
```typescript
// Arrange - Set up test data and mocks
const input = "test";
const expected = true;

// Act - Call the function
const result = myFunction(input);

// Assert - Verify the outcome
expect(result).toBe(expected);
```

### Integration Test Structure
```typescript
// Set up integration environment
await setupDatabase();

// Execute the workflow
const result = await service.process(data);

// Verify end-to-end behavior
expect(result.status).toBe("completed");
```

## Rules

1. NEVER write implementation before tests
2. ONE behavior per test
3. TESTS must be fast and isolated
4. ASSERTIONS must be clear and specific
5. MOCK external dependencies
6. RUN all tests after each change

## Commands

- Run tests: `npm test` or `bun test` or `pnpm test`
- Run single test: `npm test -- -t "test name"`
- Watch mode: `npm test -- --watch`
- Coverage: `npm test -- --coverage`

## When to Use

- New feature development
- Bug fixes (write regression test first)
- Refactoring existing code
- Learning unfamiliar codebases

## Anti-Patterns to Avoid

- Testing implementation details
- Multiple assertions on different behaviors
- Tests that depend on execution order
- Slow tests with external dependencies
- Testing private methods directly
