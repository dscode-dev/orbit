import { ArtifactExecutionProgressCalculator } from './artifact-execution.progress';

describe('ArtifactExecutionProgressCalculator', () => {
  const calculator = new ArtifactExecutionProgressCalculator();
  const sections = [
    {
      id: 'inspection',
      fields: [
        { id: 'temperature', required: true },
        { id: 'notes', required: false },
      ],
    },
  ];
  const signatures = [{ id: 'customer', required: true }];

  it('calculates pending fields, signatures and sections on the backend', () => {
    expect(calculator.calculate(sections, signatures, [], [])).toEqual({
      percentage: 0,
      totalFields: 2,
      answeredFields: 0,
      requiredFields: 1,
      requiredPending: 1,
      totalSections: 1,
      completedSections: 0,
      requiredSignatures: 1,
      pendingSignatures: 1,
      canComplete: false,
    });
  });
  it('allows completion only when required responses and signatures exist', () => {
    const result = calculator.calculate(
      sections,
      signatures,
      [
        { sectionId: 'inspection', fieldId: 'temperature' },
        { sectionId: 'inspection', fieldId: 'notes' },
      ],
      [{ slotId: 'customer', revokedAt: null }],
    );
    expect(result.percentage).toBe(100);
    expect(result.completedSections).toBe(1);
    expect(result.canComplete).toBe(true);
  });
  it('does not count revoked signatures', () => {
    const result = calculator.calculate(
      sections,
      signatures,
      [],
      [{ slotId: 'customer', revokedAt: new Date() }],
    );
    expect(result.pendingSignatures).toBe(1);
  });
});
