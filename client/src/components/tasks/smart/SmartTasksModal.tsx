import { useEffect, useState } from 'react';
import { Icons } from '../../common/Icons';
import { SmartTaskInput } from './SmartTaskInput';
import { ParsedTasksReview } from './ParsedTasksReview';
import { useSmartTasksStore } from '../../../store/smartTasksStore';

type Step = 'input' | 'review';

interface SmartTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SmartTasksModal({ isOpen, onClose }: SmartTasksModalProps) {
  const [step, setStep] = useState<Step>('input');
  const { state, reset } = useSmartTasksStore();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset to avoid visual glitch during close animation
      const timeout = setTimeout(() => {
        setStep('input');
        reset();
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, reset]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state !== 'parsing' && state !== 'clarifying') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, state]);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (step) {
      case 'input':
        return 'Smart Task Input';
      case 'review':
        return 'Review Parsed Tasks';
      default:
        return 'Smart Tasks';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-2xl w-full mx-4 animate-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-accent/20 rounded-lg text-accent">
              <Icons.sparkles />
            </div>
            <h2 className="text-lg font-semibold text-theme-primary">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
            disabled={state === 'parsing' || state === 'clarifying'}
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        {step === 'input' && (
          <SmartTaskInput
            onCancel={onClose}
            onParsed={() => setStep('review')}
          />
        )}

        {step === 'review' && (
          <ParsedTasksReview
            onBack={() => setStep('input')}
            onComplete={onClose}
          />
        )}
      </div>
    </div>
  );
}
