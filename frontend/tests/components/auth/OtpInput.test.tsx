import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OtpInput } from '../../../src/components/auth/OtpInput';

// Component tests for 6-digit OtpInput
describe('OtpInput Component', () => {
  it('should render 6 input boxes with numeric inputMode', () => {
    const value = ['', '', '', '', '', ''];
    const handleChange = vi.fn();

    render(<OtpInput value={value} onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    inputs.forEach((input, index) => {
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('aria-label', `Verification digit ${index + 1}`);
      expect(input).toHaveAttribute('maxlength', '1');
    });
  });

  it('should call onChange and focus next box when digit is typed', async () => {
    const user = userEvent.setup();
    const value = ['', '', '', '', '', ''];
    const handleChange = vi.fn();

    render(<OtpInput value={value} onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], '5');

    expect(handleChange).toHaveBeenCalledWith(['5', '', '', '', '', '']);
  });

  it('should move focus to previous input when Backspace is pressed on empty box', () => {
    const value = ['1', '', '', '', '', ''];
    const handleChange = vi.fn();

    render(<OtpInput value={value} onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[1].focus();
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('should distribute pasted 6-digit string across all input boxes', () => {
    const value = ['', '', '', '', '', ''];
    const handleChange = vi.fn();

    render(<OtpInput value={value} onChange={handleChange} />);

    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], {
      clipboardData: {
        getData: () => '123456',
      },
    });

    expect(handleChange).toHaveBeenCalledWith(['1', '2', '3', '4', '5', '6']);
  });
});
