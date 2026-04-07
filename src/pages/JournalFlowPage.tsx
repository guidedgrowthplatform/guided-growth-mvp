import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AiReflectionEntry } from '@/components/journal/AiReflectionEntry';
import { FreeformEntry } from '@/components/journal/FreeformEntry';
import { ReflectionTypeSelect } from '@/components/journal/ReflectionTypeSelect';
import { TemplateEntry } from '@/components/journal/TemplateEntry';
import { TemplateSelect } from '@/components/journal/TemplateSelect';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/hooks/useAuth';

type Step = 'select-type' | 'select-template' | 'template-entry' | 'freeform' | 'ai-reflection';
type ReflectionType = 'ai' | 'template' | 'freeform';

export function JournalFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const userName = user?.nickname ?? user?.name ?? 'there';

  const [step, setStep] = useState<Step>('select-type');
  const [selectedType, setSelectedType] = useState<ReflectionType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateAnswers, setTemplateAnswers] = useState<Record<string, string>>({});
  const [freeformTitle, setFreeformTitle] = useState('');
  const [freeformBody, setFreeformBody] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');

  const goBack = useCallback(() => {
    switch (step) {
      case 'select-type':
        navigate(-1);
        break;
      case 'select-template':
        setStep('select-type');
        break;
      case 'template-entry':
        setStep('select-template');
        break;
      case 'freeform':
      case 'ai-reflection':
        setStep('select-type');
        break;
    }
  }, [step, navigate]);

  const handleTypeContinue = useCallback(() => {
    if (selectedType === 'template') setStep('select-template');
    else if (selectedType === 'freeform') setStep('freeform');
    else if (selectedType === 'ai') setStep('ai-reflection');
  }, [selectedType]);

  const handleTemplateContinue = useCallback(() => {
    setTemplateAnswers({});
    setStep('template-entry');
  }, []);

  const handleSave = useCallback(() => {
    addToast('success', 'Reflection saved!');
    navigate('/home');
  }, [addToast, navigate]);

  switch (step) {
    case 'select-type':
      return (
        <ReflectionTypeSelect
          selected={selectedType}
          onSelect={setSelectedType}
          onContinue={handleTypeContinue}
          onBack={goBack}
          userName={userName}
        />
      );
    case 'select-template':
      return (
        <TemplateSelect
          selected={selectedTemplate}
          onSelect={setSelectedTemplate}
          onContinue={handleTemplateContinue}
          onBack={goBack}
        />
      );
    case 'template-entry':
      return (
        <TemplateEntry
          templateId={selectedTemplate ?? '5-minute-morning'}
          answers={templateAnswers}
          onAnswerChange={(i, v) => setTemplateAnswers((prev) => ({ ...prev, [String(i)]: v }))}
          onSave={handleSave}
          onBack={goBack}
        />
      );
    case 'freeform':
      return (
        <FreeformEntry
          title={freeformTitle}
          body={freeformBody}
          onTitleChange={setFreeformTitle}
          onBodyChange={setFreeformBody}
          onSave={handleSave}
          onBack={goBack}
          userName={userName}
        />
      );
    case 'ai-reflection':
      return (
        <AiReflectionEntry
          answer={aiAnswer}
          onAnswerChange={setAiAnswer}
          onDone={handleSave}
          onBack={goBack}
          userName={userName}
        />
      );
  }
}
