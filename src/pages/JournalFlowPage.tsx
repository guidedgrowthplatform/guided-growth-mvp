import { format } from 'date-fns';
import { useState, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReflectionTypeSelect } from '@/components/journal/ReflectionTypeSelect';
import { TemplateEntry } from '@/components/journal/TemplateEntry';
import { TemplateSelect } from '@/components/journal/TemplateSelect';
import { useAuth } from '@/hooks/useAuth';
import { useJournalSave } from '@/hooks/useJournalSave';

const FreeformEntry = lazy(() =>
  import('@/components/journal/FreeformEntry').then((m) => ({ default: m.FreeformEntry })),
);

type Step = 'select-type' | 'select-template' | 'template-entry' | 'freeform';
type ReflectionType = 'template' | 'freeform';

export function JournalFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { save, saving } = useJournalSave();
  const userName = user?.nickname ?? user?.name ?? 'there';

  const [step, setStep] = useState<Step>('select-type');
  const [selectedType, setSelectedType] = useState<ReflectionType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateAnswers, setTemplateAnswers] = useState<Record<string, string>>({});
  const [freeformTitle, setFreeformTitle] = useState('');
  const [mood, setMood] = useState<string | null>(null);

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
        setStep('select-type');
        break;
    }
  }, [step, navigate]);

  const handleTypeContinue = useCallback(() => {
    if (selectedType === 'template') setStep('select-template');
    else if (selectedType === 'freeform') setStep('freeform');
  }, [selectedType]);

  const handleTemplateContinue = useCallback(() => {
    setTemplateAnswers({});
    setStep('template-entry');
  }, []);

  const handleFreeformSave = useCallback(
    (body: string) => {
      const date = format(new Date(), 'yyyy-MM-dd');
      save({
        type: 'freeform',
        title: freeformTitle || undefined,
        date,
        fields: { body },
        mood,
      });
    },
    [freeformTitle, mood, save],
  );

  const handleTemplateSave = useCallback(() => {
    const date = format(new Date(), 'yyyy-MM-dd');
    save({
      type: 'template',
      template_id: selectedTemplate ?? '5-minute-morning',
      date,
      fields: templateAnswers,
      mood,
    });
  }, [selectedTemplate, templateAnswers, mood, save]);

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
          onSave={handleTemplateSave}
          onBack={goBack}
          saving={saving}
          mood={mood}
          onMoodChange={setMood}
        />
      );
    case 'freeform':
      return (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
          }
        >
          <FreeformEntry
            initialBody=""
            title={freeformTitle}
            onTitleChange={setFreeformTitle}
            onSave={handleFreeformSave}
            onBack={goBack}
            userName={userName}
            saving={saving}
            mood={mood}
            onMoodChange={setMood}
          />
        </Suspense>
      );
  }
}
