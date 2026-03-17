-- ═══════════════════════════════════════════════════════════════════
-- Guided Growth — Seed Data
-- ───────────────────────────────────────────────────────────────────
-- Run AFTER migration.sql
-- Contains: 8 categories, 26 subcategories, ~107 starter habits,
--           identity goals, journal categories, milestones
-- Source: docs.txt Section 5 (category taxonomy & starter habits)
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────
-- CATEGORIES (8)
-- ─────────────────────────────────────────

INSERT INTO categories (id, slug, name, description, icon, sort_order) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'sleep_better',       'Sleep better',         'Improve your sleep quality and consistency',    '😴', 1),
  ('c0000001-0000-0000-0000-000000000002', 'move_more',          'Move more',            'Build exercise and movement habits',            '🏃', 2),
  ('c0000001-0000-0000-0000-000000000003', 'eat_better',         'Eat better',           'Make healthier food choices',                   '🥗', 3),
  ('c0000001-0000-0000-0000-000000000004', 'feel_more_energized','Feel more energized',  'Boost your daily energy levels',                '⚡', 4),
  ('c0000001-0000-0000-0000-000000000005', 'reduce_stress',      'Reduce stress',        'Manage stress and find calm',                   '🧘', 5),
  ('c0000001-0000-0000-0000-000000000006', 'improve_focus',      'Improve focus',        'Stay productive and avoid distractions',        '🎯', 6),
  ('c0000001-0000-0000-0000-000000000007', 'break_bad_habits',   'Break bad habits',     'Replace unwanted behaviors with better ones',   '🚫', 7),
  ('c0000001-0000-0000-0000-000000000008', 'get_more_organized', 'Get more organized',   'Stay on top of tasks and keep spaces tidy',     '📋', 8);


-- ─────────────────────────────────────────
-- SUBCATEGORIES (26)
-- ─────────────────────────────────────────

INSERT INTO subcategories (id, category_id, slug, name, goal_prompt, sort_order) VALUES
  -- Sleep better (4)
  ('a0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'fall_asleep_earlier',     'Fall asleep earlier',     'Which one feels most useful: go to bed earlier, avoid late stimulation, or build a better wind-down?', 1),
  ('a0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'wake_up_earlier',         'Wake up earlier',         'Which one feels most useful: fixed wake time, earlier bedtime, or less snoozing?', 2),
  ('a0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'sleep_more_consistently', 'Sleep more consistently', 'Which one feels most useful: a fixed bedtime, a fixed wake time, or fewer late nights?', 3),
  ('a0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'sleep_more_deeply',       'Sleep more deeply',       'Which one feels most useful: reducing late stimulation, better bedroom setup, or better evening routine?', 4),

  -- Move more (4)
  ('a0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002', 'walk_more',               'Walk more',               'Which one feels most useful: daily steps, a walk break, or a scheduled walk?', 1),
  ('a0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002', 'exercise_consistently',   'Exercise consistently',   'Which one feels most useful: gym sessions, home workouts, or a fixed weekly schedule?', 2),
  ('a0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002', 'improve_mobility',        'Improve mobility',        'Which one feels most useful: morning mobility, post-work stretching, or workout recovery?', 3),

  -- Eat better (3)
  ('a0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000003', 'eat_more_intentionally',  'Eat more intentionally',  'Which one feels most useful: protein, vegetables, or less distracted eating?', 1),
  ('a0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000003', 'reduce_overeating',       'Reduce overeating',       'Which one feels most useful: slower eating, fewer impulsive snacks, or earlier stopping?', 2),
  ('a0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000003', 'plan_food_better',        'Plan food better',        'Which one feels most useful: meal planning, prepping, or default healthy choices?', 3),

  -- Feel more energized (3)
  ('a0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000004', 'more_morning_energy',     'Have more morning energy','Which one feels most useful: sunlight, hydration, or less late-night drag?', 1),
  ('a0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000004', 'avoid_afternoon_crashes', 'Avoid afternoon crashes', 'Which one feels most useful: movement, lunch choices, or caffeine timing?', 2),
  ('a0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000004', 'keep_energy_stable',      'Keep energy more stable', 'Which one feels most useful: sleep consistency, hydration, or regular movement?', 3),

  -- Reduce stress (3)
  ('a0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000005', 'feel_calmer',             'Feel calmer during the day',   'Which one feels most useful: breathing, movement, or reducing input?', 1),
  ('a0000001-0000-0000-0000-000000000015', 'c0000001-0000-0000-0000-000000000005', 'reduce_evening_stress',   'Reduce evening stress',        'Which one feels most useful: work shutdown, lower stimulation, or reflection?', 2),
  ('a0000001-0000-0000-0000-000000000016', 'c0000001-0000-0000-0000-000000000005', 'feel_less_overwhelmed',   'Feel less overwhelmed',        'Which one feels most useful: fewer open loops, better boundaries, or one daily reset?', 3),

  -- Improve focus (3)
  ('a0000001-0000-0000-0000-000000000017', 'c0000001-0000-0000-0000-000000000006', 'start_work_less_friction','Start work with less friction', 'Which one feels most useful: fewer distractions, clearer priorities, or easier startup?', 1),
  ('a0000001-0000-0000-0000-000000000018', 'c0000001-0000-0000-0000-000000000006', 'do_deeper_work',          'Do deeper work',               'Which one feels most useful: a focus block, notifications off, or a fixed deep-work window?', 2),
  ('a0000001-0000-0000-0000-000000000019', 'c0000001-0000-0000-0000-000000000006', 'procrastinate_less',      'Procrastinate less',           'Which one feels most useful: easier task starts, better commitment, or fewer escape routes?', 3),

  -- Break bad habits (7)
  ('a0000001-0000-0000-0000-000000000020', 'c0000001-0000-0000-0000-000000000007', 'smoking',                 'Smoking',                 'Do you want to stop completely or cut back?', 1),
  ('a0000001-0000-0000-0000-000000000021', 'c0000001-0000-0000-0000-000000000007', 'weed',                    'Weed',                    'Do you want to stop completely or cut back?', 2),
  ('a0000001-0000-0000-0000-000000000022', 'c0000001-0000-0000-0000-000000000007', 'alcohol',                 'Alcohol',                 'Do you want to stop completely or cut back?', 3),
  ('a0000001-0000-0000-0000-000000000023', 'c0000001-0000-0000-0000-000000000007', 'porn',                    'Porn',                    'Do you want to stop completely or cut back?', 4),
  ('a0000001-0000-0000-0000-000000000024', 'c0000001-0000-0000-0000-000000000007', 'phone_use',               'Phone use',               'Do you want to stop completely or cut back?', 5),
  ('a0000001-0000-0000-0000-000000000025', 'c0000001-0000-0000-0000-000000000007', 'late_night_snacking',     'Late-night snacking',     'Do you want to stop completely or cut back?', 6),
  ('a0000001-0000-0000-0000-000000000026', 'c0000001-0000-0000-0000-000000000007', 'caffeine',                'Caffeine',                'Do you want to stop completely or cut back?', 7),

  -- Get more organized (3)
  ('a0000001-0000-0000-0000-000000000027', 'c0000001-0000-0000-0000-000000000008', 'stay_on_top_of_tasks',    'Stay on top of tasks',    'Which one feels most useful: daily planning, one trusted list, or less inbox chaos?', 1),
  ('a0000001-0000-0000-0000-000000000028', 'c0000001-0000-0000-0000-000000000008', 'keep_spaces_tidy',        'Keep spaces tidy',        'Which one feels most useful: desk resets, room resets, or weekly cleanups?', 2),
  ('a0000001-0000-0000-0000-000000000029', 'c0000001-0000-0000-0000-000000000008', 'handle_life_admin',       'Handle life admin better','Which one feels most useful: a weekly admin session, calendar review, or paying attention to loose ends?', 3);


-- ─────────────────────────────────────────
-- STARTER HABITS (~107)
-- ─────────────────────────────────────────

-- === Sleep better > Fall asleep earlier ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'No caffeine after 2 PM',        'Yes if no caffeine after 2 PM',                  'binary_avoid', '{daily,weekdays,custom}',  '2 PM',   FALSE, 1),
  ('a0000001-0000-0000-0000-000000000001', 'No screens after 10 PM',        'Yes if no recreational screen use after 10 PM',   'binary_avoid', '{daily,weekdays,custom}',  '10 PM',  FALSE, 2),
  ('a0000001-0000-0000-0000-000000000001', 'Start wind-down by 10 PM',      'Yes if wind-down routine started by 10 PM',       'binary_do',    '{daily,weekdays,custom}',  NULL,     TRUE,  3),
  ('a0000001-0000-0000-0000-000000000001', 'Be in bed by target bedtime',   'Yes if physically in bed by chosen bedtime',      'binary_do',    '{daily,weekdays,custom}',  NULL,     FALSE, 4);

-- === Sleep better > Wake up earlier ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000002', 'Out of bed by target time',     'Yes if out of bed by chosen time',                'binary_do',    '{daily,weekdays,custom}',  FALSE, 1),
  ('a0000001-0000-0000-0000-000000000002', 'No snooze',                     'Yes if no snooze button used',                    'binary_avoid', '{daily,weekdays,custom}',  FALSE, 2),
  ('a0000001-0000-0000-0000-000000000002', 'Phone stays outside bedroom',   'Yes if phone was charged outside bedroom',        'binary_do',    '{daily,weekdays,custom}',  TRUE,  3),
  ('a0000001-0000-0000-0000-000000000002', 'Lights out by target bedtime',  'Yes if lights out by chosen bedtime',             'binary_do',    '{daily,weekdays,custom}',  FALSE, 4);

-- === Sleep better > Sleep more consistently ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000003', 'Same bedtime within 30 minutes',  'Yes if bedtime was within chosen 30-minute window', 'binary_do',    '{daily,weekdays,weekends}', NULL,   1),
  ('a0000001-0000-0000-0000-000000000003', 'Same wake time within 30 minutes','Yes if wake time was within chosen 30-minute window','binary_do',    '{daily,weekdays,weekends}', NULL,   2),
  ('a0000001-0000-0000-0000-000000000003', 'No screens in bed',               'Yes if no screen use while in bed',                 'binary_avoid', '{daily,weekdays,custom}',   NULL,   3),
  ('a0000001-0000-0000-0000-000000000003', 'No food after 9 PM',              'Yes if no eating after chosen cutoff',              'binary_avoid', '{daily,weekdays,custom}',   '9 PM', 4);

-- === Sleep better > Sleep more deeply ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000004', 'Bedroom cool and dark before bed',    'Yes if room was set up before bed',               'binary_do',    '{daily,custom}',            1),
  ('a0000001-0000-0000-0000-000000000004', 'No alcohol on sleep nights',          'Yes if no alcohol on selected nights',             'binary_avoid', '{daily,custom}',            2),
  ('a0000001-0000-0000-0000-000000000004', 'No heavy meal within 2 hours of bed', 'Yes if no heavy meal in final 2 hours',           'binary_avoid', '{daily,custom}',            3),
  ('a0000001-0000-0000-0000-000000000004', 'Read 10 pages before bed',            'Yes if 10 pages read before bed',                 'binary_do',    '{daily,weekdays,custom}',   4);

-- === Move more > Walk more ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, threshold_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000005', '8,000+ steps',                    'Yes if 8,000 steps reached',                      'threshold',    '{daily,weekdays,weekends}', '8000 steps', 1),
  ('a0000001-0000-0000-0000-000000000005', '10-minute walk after lunch',      'Yes if walk completed after lunch',                'binary_do',    '{daily,weekdays,custom}',   NULL,         2),
  ('a0000001-0000-0000-0000-000000000005', '10-minute walk after dinner',     'Yes if walk completed after dinner',               'binary_do',    '{daily,weekdays,custom}',   NULL,         3),
  ('a0000001-0000-0000-0000-000000000005', 'Stand up once each work hour',    'Yes if standing break completed each work hour',   'binary_do',    '{weekdays,custom}',         NULL,         4);

-- === Move more > Exercise consistently ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000006', 'Workout on 2 selected days',           'Yes if workout completed on each selected day',   'binary_do',    '{2_specific_days,custom}',                1),
  ('a0000001-0000-0000-0000-000000000006', 'Workout on 3 selected days',           'Yes if workout completed on each selected day',   'binary_do',    '{3_specific_days,custom}',                2),
  ('a0000001-0000-0000-0000-000000000006', '20-minute home workout',               'Yes if 20-minute workout completed',              'binary_do',    '{daily,2_specific_days,3_specific_days}',  3),
  ('a0000001-0000-0000-0000-000000000006', 'Lay out workout clothes the night before','Yes if clothes were laid out before bed',       'binary_do',    '{custom}',                                4);

-- === Move more > Improve mobility ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000007', '5-minute morning stretch',        'Yes if stretch completed',                        'binary_do',    '{daily,weekdays,custom}',   TRUE,  1),
  ('a0000001-0000-0000-0000-000000000007', '5-minute post-work stretch',      'Yes if stretch completed after work',             'binary_do',    '{daily,weekdays,custom}',   TRUE,  2),
  ('a0000001-0000-0000-0000-000000000007', 'Stretch after each workout',      'Yes if stretch completed after workout',          'event_based',  '{custom}',                  FALSE, 3),
  ('a0000001-0000-0000-0000-000000000007', '2-minute desk stretch at 3 PM',   'Yes if stretch completed at target time',         'binary_do',    '{weekdays,custom}',         TRUE,  4);

-- === Eat better > Eat more intentionally ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000008', 'Protein at breakfast',            'Yes if breakfast included a protein source',       'binary_do',    '{daily,weekdays,custom}',  1),
  ('a0000001-0000-0000-0000-000000000008', 'Vegetables at lunch',             'Yes if lunch included vegetables',                 'binary_do',    '{daily,weekdays,custom}',  2),
  ('a0000001-0000-0000-0000-000000000008', 'Vegetables at dinner',            'Yes if dinner included vegetables',                'binary_do',    '{daily,weekdays,custom}',  3),
  ('a0000001-0000-0000-0000-000000000008', 'No eating while scrolling',       'Yes if meals were eaten without social media/video scrolling', 'binary_avoid', '{daily,weekdays,custom}', 4);

-- === Eat better > Reduce overeating ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000009', 'No second helping at dinner',     'Yes if no second serving taken',                   'binary_avoid', '{daily,custom}',           NULL,   1),
  ('a0000001-0000-0000-0000-000000000009', 'One planned snack max',           'Yes if no more than one planned snack',            'binary_avoid', '{daily,weekdays,custom}',  NULL,   2),
  ('a0000001-0000-0000-0000-000000000009', 'No food after 9 PM',             'Yes if no eating after chosen cutoff',              'binary_avoid', '{daily,weekdays,custom}',  '9 PM', 3),
  ('a0000001-0000-0000-0000-000000000009', 'Drink water before dinner',       'Yes if a glass of water was finished before dinner','binary_do',   '{daily,custom}',           NULL,   4);

-- === Eat better > Plan food better ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000010', 'Plan tomorrow''s meals tonight',  'Yes if next day meals were chosen the night before','binary_do',    '{daily,weekdays}',         1),
  ('a0000001-0000-0000-0000-000000000010', 'Prep lunch for tomorrow',         'Yes if lunch was prepared in advance',              'binary_do',    '{weekdays,custom}',        2),
  ('a0000001-0000-0000-0000-000000000010', 'Buy groceries on selected day',   'Yes if grocery trip/order completed',               'binary_do',    '{once_a_week,custom}',     3),
  ('a0000001-0000-0000-0000-000000000010', 'Pack a healthy snack',            'Yes if healthy snack packed before leaving home',   'binary_do',    '{weekdays,custom}',        4);

-- === Feel more energized > Morning energy ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000011', 'Get outside within 30 minutes of waking', 'Yes if outside within 30 minutes of waking',   'binary_do',    '{daily,weekdays,custom}',  NULL,    1),
  ('a0000001-0000-0000-0000-000000000011', 'Drink water before coffee',               'Yes if water finished before first coffee',    'binary_do',    '{daily,weekdays,custom}',  NULL,    2),
  ('a0000001-0000-0000-0000-000000000011', 'Eat breakfast within 90 minutes of waking','Yes if breakfast eaten within 90 minutes',    'binary_do',    '{daily,weekdays,custom}',  NULL,    3),
  ('a0000001-0000-0000-0000-000000000011', 'No screens after 10 PM',                  'Yes if no recreational screen use after 10 PM','binary_avoid', '{daily,weekdays,custom}',  '10 PM', 4);

-- === Feel more energized > Avoid afternoon crashes ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000012', '10-minute walk after lunch',      'Yes if walk completed after lunch',                'binary_do',    '{weekdays,custom}',        NULL,    1),
  ('a0000001-0000-0000-0000-000000000012', 'No caffeine after 2 PM',          'Yes if no caffeine after 2 PM',                    'binary_avoid', '{daily,weekdays,custom}',  '2 PM',  2),
  ('a0000001-0000-0000-0000-000000000012', 'Protein with lunch',              'Yes if lunch included a protein source',           'binary_do',    '{weekdays,custom}',        NULL,    3),
  ('a0000001-0000-0000-0000-000000000012', 'No sugary drink after lunch',     'Yes if no sugary drink after lunch',               'binary_avoid', '{weekdays,custom}',        NULL,    4);

-- === Feel more energized > Keep energy stable ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, threshold_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000013', '2 liters of water',              'Yes if daily water target reached',                'threshold',    '{daily,weekdays,custom}',  '2 liters', 1),
  ('a0000001-0000-0000-0000-000000000013', 'Stand up once each work hour',   'Yes if standing break completed each work hour',   'binary_do',    '{weekdays,custom}',        NULL,       2),
  ('a0000001-0000-0000-0000-000000000013', 'In bed by target bedtime',       'Yes if physically in bed by chosen bedtime',       'binary_do',    '{daily,weekdays,custom}',  NULL,       3),
  ('a0000001-0000-0000-0000-000000000013', '15-minute walk',                 'Yes if walk completed',                            'binary_do',    '{daily,weekdays,custom}',  NULL,       4);

-- === Reduce stress > Feel calmer ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000014', '5-minute breathing session',         'Yes if 5-minute session completed',              'binary_do',    '{daily,weekdays,custom}',  TRUE,  1),
  ('a0000001-0000-0000-0000-000000000014', '10-minute walk without phone',       'Yes if phone-free walk completed',               'binary_do',    '{daily,weekdays,custom}',  FALSE, 2),
  ('a0000001-0000-0000-0000-000000000014', 'No notifications during first work block','Yes if notifications stayed off during first work block','binary_avoid','{weekdays,custom}', FALSE, 3),
  ('a0000001-0000-0000-0000-000000000014', '2-minute reset at lunch',            'Yes if reset completed at lunch',                'binary_do',    '{weekdays,custom}',        TRUE,  4);

-- === Reduce stress > Reduce evening stress ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000015', 'End work by target time',            'Yes if work ended by chosen time',               'binary_do',    '{weekdays,custom}',        1),
  ('a0000001-0000-0000-0000-000000000015', 'Write tomorrow''s top 3 before bed', 'Yes if top 3 written before bed',                'binary_do',    '{weekdays,custom}',        2),
  ('a0000001-0000-0000-0000-000000000015', 'No work email after target time',    'Yes if no work email checked after chosen time',  'binary_avoid', '{weekdays,custom}',        3),
  ('a0000001-0000-0000-0000-000000000015', '10-minute wind-down',                'Yes if wind-down completed',                     'binary_do',    '{daily,weekdays,custom}',  4);

-- === Reduce stress > Feel less overwhelmed ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000016', 'Capture all tasks in one list',       'Yes if all new tasks were captured in one place','binary_do',    '{daily,weekdays,custom}',  1),
  ('a0000001-0000-0000-0000-000000000016', 'One 15-minute admin block',           'Yes if admin block completed',                  'binary_do',    '{weekdays,custom}',        2),
  ('a0000001-0000-0000-0000-000000000016', 'Say no to one nonessential task',     'Yes if one nonessential ask was declined or deferred','binary_do','{weekdays,custom}',       3),
  ('a0000001-0000-0000-0000-000000000016', 'Take one screen-free break',          'Yes if one screen-free break completed',         'binary_do',    '{daily,weekdays,custom}',  4);

-- === Improve focus > Start work with less friction ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000017', 'Write top 3 priorities before starting work','Yes if top 3 written before first work block','binary_do','{weekdays,custom}',       FALSE, 1),
  ('a0000001-0000-0000-0000-000000000017', 'Phone in another room for first work block', 'Yes if phone stayed in another room for first work block','binary_do','{weekdays,custom}', FALSE, 2),
  ('a0000001-0000-0000-0000-000000000017', 'Start first work block by target time',       'Yes if first focused block started by chosen time','binary_do','{weekdays,custom}',    FALSE, 3),
  ('a0000001-0000-0000-0000-000000000017', 'Desk cleared before first work block',        'Yes if desk cleared before starting',        'binary_do',    '{weekdays,custom}',    TRUE,  4);

-- === Improve focus > Do deeper work ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000018', 'One 45-minute focus block',           'Yes if 45-minute focus block completed',         'binary_do',    '{weekdays,custom}',        NULL,   1),
  ('a0000001-0000-0000-0000-000000000018', 'Two 45-minute focus blocks',          'Yes if both focus blocks completed',             'binary_do',    '{weekdays,custom}',        NULL,   2),
  ('a0000001-0000-0000-0000-000000000018', 'Notifications off during focus block','Yes if notifications stayed off for focus block','binary_avoid', '{weekdays,custom}',        NULL,   3),
  ('a0000001-0000-0000-0000-000000000018', 'No social media before lunch',        'Yes if no social media before lunch',            'binary_avoid', '{weekdays,custom}',        'lunch',4);

-- === Improve focus > Procrastinate less ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000019', 'Start hardest task before checking messages', 'Yes if hardest task started before checking messages','binary_do','{weekdays,custom}', FALSE, 1),
  ('a0000001-0000-0000-0000-000000000019', 'Work 10 minutes on avoided task',             'Yes if 10 minutes completed on avoided task',         'binary_do','{weekdays,custom}', TRUE,  2),
  ('a0000001-0000-0000-0000-000000000019', 'Block distracting sites during work hours',   'Yes if blocker stayed on during work hours',          'binary_do','{weekdays,custom}', FALSE, 3),
  ('a0000001-0000-0000-0000-000000000019', 'Choose one must-do task the night before',    'Yes if must-do task chosen night before',             'binary_do','{weekdays,custom}', FALSE, 4);

-- === Break bad habits > Smoking ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, is_replacement, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000020', 'No cigarettes today',               'Yes if zero cigarettes smoked today',             'binary_avoid', '{daily,custom}',        NULL,   FALSE, 1),
  ('a0000001-0000-0000-0000-000000000020', 'No smoking before noon',            'Yes if no cigarettes before noon',                'binary_avoid', '{daily,weekdays,custom}','noon', FALSE, 2),
  ('a0000001-0000-0000-0000-000000000020', 'Do urge delay before each cigarette','Yes if 10-minute delay used before every cigarette','binary_do','{daily,custom}',         NULL,   FALSE, 3),
  ('a0000001-0000-0000-0000-000000000020', 'Carry gum instead of cigarettes',    'Yes if gum carried all day',                     'binary_do',    '{daily,custom}',        NULL,   TRUE,  4);

-- === Break bad habits > Weed ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, is_replacement, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000021', 'No weed today',                     'Yes if zero weed used today',                    'binary_avoid', '{daily,custom}',          NULL,    FALSE, 1),
  ('a0000001-0000-0000-0000-000000000021', 'No weed on weeknights',             'Yes if no weed used on selected weeknights',     'binary_avoid', '{weekdays,custom}',       NULL,    FALSE, 2),
  ('a0000001-0000-0000-0000-000000000021', 'No weed before 8 PM',               'Yes if no weed used before 8 PM',                'binary_avoid', '{daily,custom}',          '8 PM',  FALSE, 3),
  ('a0000001-0000-0000-0000-000000000021', 'Replace evening use with 10-minute walk','Yes if replacement walk completed on urge nights','binary_do','{daily,custom}',         NULL,    TRUE,  4);

-- === Break bad habits > Alcohol ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, threshold_label, is_replacement, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000022', 'No alcohol today',                  'Yes if zero drinks today',                       'binary_avoid', '{daily,custom}',           NULL,        FALSE, 1),
  ('a0000001-0000-0000-0000-000000000022', 'No alcohol on weekdays',            'Yes if zero drinks on weekdays',                 'binary_avoid', '{weekdays}',               NULL,        FALSE, 2),
  ('a0000001-0000-0000-0000-000000000022', 'Max 2 drinks on selected nights',   'Yes if drinks stayed at or below limit',         'threshold',    '{custom,weekends}',        '2 drinks',  FALSE, 3),
  ('a0000001-0000-0000-0000-000000000022', 'Order nonalcoholic first drink',    'Yes if first drink was nonalcoholic',             'binary_do',    '{custom}',                 NULL,        TRUE,  4);

-- === Break bad habits > Porn ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000023', 'No porn today',                     'Yes if no porn viewed today',                    'binary_avoid', '{daily,custom}',           NULL,    1),
  ('a0000001-0000-0000-0000-000000000023', 'No porn after 10 PM',               'Yes if no porn viewed after 10 PM',              'binary_avoid', '{daily,custom}',           '10 PM', 2),
  ('a0000001-0000-0000-0000-000000000023', 'Phone stays out of bedroom',        'Yes if phone charged outside bedroom',           'binary_do',    '{daily,custom}',           NULL,    3),
  ('a0000001-0000-0000-0000-000000000023', 'Use blocker on selected devices',   'Yes if blocker remained enabled all day',        'binary_do',    '{daily,custom}',           NULL,    4);

-- === Break bad habits > Phone use ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, threshold_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000024', 'No phone during first 30 minutes after waking','Yes if phone unused for first 30 minutes','binary_avoid','{daily,weekdays,custom}',NULL,             1),
  ('a0000001-0000-0000-0000-000000000024', 'No phone during meals',             'Yes if no phone used during meals',               'binary_avoid', '{daily,custom}',          NULL,             2),
  ('a0000001-0000-0000-0000-000000000024', 'Phone outside bedroom',             'Yes if phone charged outside bedroom',            'binary_do',    '{daily,weekdays,custom}', NULL,             3),
  ('a0000001-0000-0000-0000-000000000024', 'Social apps under target minutes',  'Yes if total social app time stayed under chosen limit','threshold','{daily,weekdays,custom}','target minutes', 4);

-- === Break bad habits > Late-night snacking ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, is_replacement, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000025', 'No calories after 9 PM',            'Yes if no calories consumed after chosen cutoff', 'binary_avoid', '{daily,weekdays,custom}',  '9 PM', FALSE, 1),
  ('a0000001-0000-0000-0000-000000000025', 'Kitchen closed after dinner',        'Yes if no kitchen/snack trip after dinner',      'binary_avoid', '{daily,custom}',           NULL,   FALSE, 2),
  ('a0000001-0000-0000-0000-000000000025', 'Brush teeth after dinner',           'Yes if teeth brushed after dinner',               'binary_do',    '{daily,custom}',           NULL,   TRUE,  3),
  ('a0000001-0000-0000-0000-000000000025', 'Prepare planned evening tea instead','Yes if tea prepared instead of snack on urge nights','binary_do','{daily,custom}',           NULL,   TRUE,  4);

-- === Break bad habits > Caffeine ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, cutoff_label, threshold_label, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000026', 'No caffeine after 2 PM',            'Yes if no caffeine after 2 PM',                   'binary_avoid', '{daily,weekdays,custom}',  '2 PM', NULL,                  1),
  ('a0000001-0000-0000-0000-000000000026', 'Max 2 caffeinated drinks',           'Yes if stayed at or below chosen max',            'threshold',    '{daily,custom}',           NULL,   '2 caffeinated drinks',2),
  ('a0000001-0000-0000-0000-000000000026', 'Water before first caffeine',        'Yes if water finished before first caffeine',     'binary_do',    '{daily,weekdays,custom}',  NULL,   NULL,                  3),
  ('a0000001-0000-0000-0000-000000000026', 'No energy drinks',                   'Yes if zero energy drinks today',                 'binary_avoid', '{daily,custom}',           NULL,   NULL,                  4);

-- === Get more organized > Stay on top of tasks ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000027', 'Check task list before starting work','Yes if task list reviewed before first work block','binary_do',   '{weekdays,custom}',        1),
  ('a0000001-0000-0000-0000-000000000027', 'Use one task list only',              'Yes if all tasks captured in one place',          'binary_do',    '{daily,weekdays,custom}',  2),
  ('a0000001-0000-0000-0000-000000000027', 'Plan tomorrow before ending work',    'Yes if tomorrow plan written before end of day',  'binary_do',    '{weekdays,custom}',        3),
  ('a0000001-0000-0000-0000-000000000027', 'Clear inbox to target number',        'Yes if inbox reached chosen number',              'threshold',    '{weekdays,custom}',        4);

-- === Get more organized > Keep spaces tidy ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, is_two_minute, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000028', '10-minute desk reset',               'Yes if desk reset completed',                    'binary_do',    '{weekdays,custom}',        FALSE, 1),
  ('a0000001-0000-0000-0000-000000000028', '10-minute evening tidy',             'Yes if tidy completed',                           'binary_do',    '{daily,weekdays,custom}',  FALSE, 2),
  ('a0000001-0000-0000-0000-000000000028', 'Put clothes away before bed',         'Yes if clothes put away before bed',              'binary_do',    '{daily,custom}',           TRUE,  3),
  ('a0000001-0000-0000-0000-000000000028', 'One weekly reset block',              'Yes if weekly reset completed',                   'binary_do',    '{once_a_week,custom}',     FALSE, 4);

-- === Get more organized > Handle life admin ===
INSERT INTO starter_habits (subcategory_id, name, completion_rule, habit_type, default_cadence_options, sort_order) VALUES
  ('a0000001-0000-0000-0000-000000000029', 'Check calendar every morning',        'Yes if calendar reviewed in morning',            'binary_do',    '{weekdays,custom}',                1),
  ('a0000001-0000-0000-0000-000000000029', '15-minute admin block',               'Yes if admin block completed',                   'binary_do',    '{once_a_week,2_specific_days,custom}', 2),
  ('a0000001-0000-0000-0000-000000000029', 'Pay bills on selected day',           'Yes if bill task completed on selected day',     'binary_do',    '{once_a_week,custom}',              3),
  ('a0000001-0000-0000-0000-000000000029', 'Process mail and papers',             'Yes if mail/papers processed',                   'binary_do',    '{once_a_week,custom}',              4);


-- ─────────────────────────────────────────
-- IDENTITY GOALS
-- ─────────────────────────────────────────

INSERT INTO identity_goals (name, category_id, sort_order) VALUES
  ('a well-rested person',     'c0000001-0000-0000-0000-000000000001', 1),
  ('an active person',         'c0000001-0000-0000-0000-000000000002', 2),
  ('a healthy eater',          'c0000001-0000-0000-0000-000000000003', 3),
  ('an energetic person',      'c0000001-0000-0000-0000-000000000004', 4),
  ('a calm person',            'c0000001-0000-0000-0000-000000000005', 5),
  ('a focused person',         'c0000001-0000-0000-0000-000000000006', 6),
  ('a disciplined person',     'c0000001-0000-0000-0000-000000000007', 7),
  ('an organized person',      'c0000001-0000-0000-0000-000000000008', 8),
  ('a mindful person',         NULL, 9),
  ('a consistent person',      NULL, 10),
  ('a reader',                 NULL, 11),
  ('a person who keeps promises to myself', NULL, 12);


-- ─────────────────────────────────────────
-- JOURNAL CATEGORIES
-- ─────────────────────────────────────────

INSERT INTO journal_categories (name, icon, sort_order) VALUES
  ('Gratitude',   '🙏', 1),
  ('Reflection',  '🪞', 2),
  ('Goals',       '🎯', 3),
  ('Wins',        '🏆', 4),
  ('Free Write',  '✏️', 5);


-- ─────────────────────────────────────────
-- MILESTONES
-- ─────────────────────────────────────────

INSERT INTO milestones (name, description, icon, milestone_type, required_value) VALUES
  -- Streak milestones
  ('3-Day Streak',          'Completed a habit 3 days in a row',         '🔥', 'streak',      3),
  ('7-Day Streak',          'One full week of consistency',              '🔥', 'streak',      7),
  ('14-Day Streak',         'Two weeks strong',                         '🔥', 'streak',      14),
  ('30-Day Streak',         'A full month — habit is forming',          '🔥', 'streak',      30),
  ('60-Day Streak',         'Two months — this is who you are now',     '🔥', 'streak',      60),
  ('100-Day Streak',        'Triple digits — incredible discipline',    '💎', 'streak',      100),

  -- Completion milestones
  ('First Completion',      'Completed your first habit check-in',       '⭐', 'completions', 1),
  ('10 Completions',        '10 total habit completions',                '⭐', 'completions', 10),
  ('50 Completions',        '50 total habit completions',                '⭐', 'completions', 50),
  ('100 Completions',       'A century of completions',                  '💯', 'completions', 100),
  ('500 Completions',       'Unstoppable — 500 completions',            '👑', 'completions', 500),

  -- Focus milestones
  ('First Focus Session',   'Completed your first focus session',        '🎯', 'focus',       1),
  ('10 Focus Sessions',     '10 focus sessions completed',               '🎯', 'focus',       10),
  ('50 Focus Sessions',     'Deep work warrior — 50 sessions',          '🧠', 'focus',       50),

  -- Journal milestones
  ('First Journal Entry',   'Wrote your first reflection',               '📝', 'journal',     1),
  ('10 Journal Entries',    '10 reflections written',                     '📝', 'journal',     10),
  ('30 Journal Entries',    'A month of self-reflection',                '📖', 'journal',     30);

