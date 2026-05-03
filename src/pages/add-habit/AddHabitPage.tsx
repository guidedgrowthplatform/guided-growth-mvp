import { AdvancedEditPhase } from './AdvancedEditPhase';
import { AdvancedInputPhase } from './AdvancedInputPhase';
import { AdvancedResultsPhase } from './AdvancedResultsPhase';
import { BeginnerConfirmPhase } from './BeginnerConfirmPhase';
import { BeginnerSelectPhase } from './BeginnerSelectPhase';
import { ChoosePathPhase } from './ChoosePathPhase';
import { useAddHabitState } from './useAddHabitState';
import { categories } from './useBeginnerPath';

export function AddHabitPage() {
  const s = useAddHabitState();

  switch (s.phase) {
    case 'choose-path':
      return (
        <ChoosePathPhase
          path={s.path}
          setPath={s.setPath}
          onContinue={s.handlePathContinue}
          onBack={s.handleBack}
        />
      );

    case 'beginner-select':
      return (
        <BeginnerSelectPhase
          categories={categories}
          expandedCategory={s.expandedCategory}
          setExpandedCategory={s.setExpandedCategory}
          selectedHabits={s.selectedHabits}
          customHabits={s.customHabits}
          toggleHabit={s.toggleHabit}
          addCustomHabit={s.addCustomHabit}
          onContinue={s.startCustomizationQueue}
          customizingHabit={s.customizingHabit}
          onSheetClose={s.handleSheetClose}
          onSheetNext={s.handleBeginnerSheetNext}
          isLastHabit={s.isLastHabit}
          onBack={s.handleBack}
        />
      );

    case 'beginner-confirm':
      return (
        <BeginnerConfirmPhase
          habitConfigs={s.habitConfigs}
          onEditHabit={s.handleEditHabit}
          onConfirm={s.handleConfirm}
          saving={s.saving}
          customizingHabit={s.customizingHabit}
          onSheetClose={s.handleSheetClose}
          onSheetNext={s.handleBeginnerSheetNext}
          isLastHabit={s.isLastHabit}
          onBack={s.handleBack}
        />
      );

    case 'advanced-input':
      return (
        <AdvancedInputPhase
          brainDumpText={s.brainDumpText}
          setBrainDumpText={s.setBrainDumpText}
          textareaRef={s.textareaRef}
          isListening={s.isListening}
          toggleVoice={s.toggleVoice}
          onDone={s.handleBrainDumpDone}
          onBack={s.handleBack}
        />
      );

    case 'advanced-results':
      return (
        <AdvancedResultsPhase
          advancedHabits={s.advancedHabits}
          onEditHabit={s.handleAdvancedEditStart}
          onConfirm={s.handleConfirm}
          saving={s.saving}
          onStartOver={s.handleAdvancedStartOver}
          onBack={s.handleBack}
        />
      );

    case 'advanced-edit':
      return (
        <AdvancedEditPhase
          editName={s.editName}
          setEditName={s.setEditName}
          editDays={s.editDays}
          setEditDays={s.setEditDays}
          editTime={s.editTime}
          setEditTime={s.setEditTime}
          onSave={s.handleAdvancedEditSave}
          onDelete={s.requestDelete}
          showDeleteModal={s.showDeleteModal}
          onConfirmDelete={s.handleAdvancedDelete}
          onCancelDelete={s.cancelDelete}
          isListening={s.isListening}
          toggleVoice={s.toggleVoice}
          onBack={s.handleBack}
        />
      );
  }
}
