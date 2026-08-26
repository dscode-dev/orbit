import {
  classifyInternalError,
  internalErrorStack,
} from './infrastructure-error.classifier';

describe('classifyInternalError', () => {
  it.each([
    ['ECONNRESET', 'CONNECTION_FAILURE'],
    ['ETIMEDOUT', 'DATABASE_TIMEOUT'],
    ['P2028', 'TRANSACTION_FAILURE'],
    ['P1001', 'DATABASE_UNAVAILABLE'],
  ])('classifies %s as %s', (code, category) => {
    const error = Object.assign(new Error('failure'), { code });
    expect(classifyInternalError(error).category).toBe(category);
  });

  it('does not classify arbitrary domain errors as infrastructure', () => {
    expect(classifyInternalError(new Error('invalid token')).category).toBe(
      'INTERNAL_ERROR',
    );
  });
});

describe('internalErrorStack', () => {
  it('keeps the wrapped cause for internal logs', () => {
    const cause = new Error('connection reset by peer');
    const wrapped = new Error('infrastructure operation failed', { cause });
    expect(internalErrorStack(wrapped)).toContain('Caused by:');
    expect(internalErrorStack(wrapped)).toContain('connection reset by peer');
  });
});
