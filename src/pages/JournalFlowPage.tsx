import { format } from 'date-fns';
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '@/analytics';
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

  const completedRef = useRef(false);
  const mountTimeRef = useRef<number>(0);
  const selectedTypeRef = useRef<ReflectionType | null>(null);

  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  useEffect(() => {
    mountTimeRef.current = Date.now();
    const start = mountTimeRef.current;
    track('open_journal', { trigger: 'home' });
    return () => {
      if (!completedRef.current) {
        track('abandon_journal', {
          journal_type: selectedTypeRef.current ?? 'not_selected',
          time_spent_seconds: Math.round((Date.now() - start) / 1000),
        });
      }
    };
  }, []);

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
    if (selectedType === 'template') {
      track('select_journal_type', { type: 'template' });
      setStep('select-template');
    } else if (selectedType === 'freeform') {
      track('select_journal_type', { type: 'freeform' });
      setStep('freeform');
    }
  }, [selectedType]);

  const handleTemplateContinue = useCallback(() => {
    setTemplateAnswers({});
    setStep('template-entry');
  }, []);

  const handleFreeformSave = useCallback(
    async (body: string) => {
      const date = format(new Date(), 'yyyy-MM-dd');
      const ok = await save({
        type: 'freeform',
        title: freeformTitle || undefined,
        date,
        fields: { body },
        mood,
      });
      if (ok) {
        completedRef.current = true;
        track('complete_journal_entry', {
          journal_type: 'freeform',
          has_title: Boolean(freeformTitle),
          entry_length_chars: body.length,
          duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
        });
      }
    },
    [freeformTitle, mood, save],
  );

  const handleTemplateSave = useCallback(async () => {
    const date = format(new Date(), 'yyyy-MM-dd');
    const templateId = selectedTemplate ?? '5-minute-morning';
    const ok = await save({
      type: 'template',
      template_id: templateId,
      date,
      fields: templateAnswers,
      mood,
    });
    if (ok) {
      completedRef.current = true;
      track('complete_journal_entry', {
        journal_type: 'template',
        template_id: templateId,
        prompts_answered_count: Object.keys(templateAnswers).length,
        duration_seconds: Math.round((Date.now() - mountTimeRef.current) / 1000),
      });
    }
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
