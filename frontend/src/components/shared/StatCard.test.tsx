import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Shield } from 'lucide-react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders value and label', () => {
    render(
      <StatCard
        icon={<Shield data-testid="icon" />}
        iconBg="bg-green-50"
        label="Guardians on duty"
        value="28"
        delta="+3"
        deltaPositive={true}
        deltaLabel="from yesterday"
      />,
    );
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('Guardians on duty')).toBeTruthy();
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('applies red color for negative delta', () => {
    render(
      <StatCard
        icon={<Shield />}
        iconBg="bg-orange-50"
        label="Pending"
        value="12"
        delta="-2"
        deltaPositive={false}
        deltaLabel="from yesterday"
      />,
    );
    const deltaEl = screen.getByText('-2');
    expect(deltaEl.className).toContain('text-red-500');
  });
});
