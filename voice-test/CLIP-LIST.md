# Onboarding voice clips, review before generating

Voice: **V1 Pro Voice Clone** (`104635f9`), model `sonic-3.5-2026-05-04`, **default settings** (no speed/emotion controls). WAV, one clip per complete line.

Every clip is a whole sentence. A few (marked LEAD-IN) are the first half of a two-part delivery and must play immediately before the line under them, that is by design, not a cut.


### COACH-GREETING
1. `[-]` Hey, I might have startled you. You're probably not used to an app just talking to you. I'm your AI coach here at your service at Guided Growth, and I'm excited to help you improve things in your life that are important to you. So let's get you in, and we'll get started.

### MIC-PERMISSION
2. `[opener]` I'd love to actually talk with you. If you let me use your mic, you can just speak.

### ONBOARD-01--FORM
3. `[opener]` **[LIVE, name varies, not pre-rendered]** Good to meet you, {name}. Two quick things so I can tailor this to you.
4. `[-]` How old are you?
5. `[-]` What's your gender?

### ONBOARD-STATE-CHECK
6. `[-]` *(lead-in)* I'd like to invite you into a coaching process together. And it's built on a few components we'll go through on the way in. It's built light. I believe less is more, especially in the beginning of a process.
7. `[-]` Whether you've never done something like this before or you already track a lot, it is built for you. I'll explain each part as we go. This is the first part, a quick state check-in. And I'd like you to do it right now.
8. `[state_sleep]` How's your sleep?
9. `[state_mood]` How's your mood?
10. `[state_energy]` How's your energy?
11. `[state_stress]` How's your stress?

### ONBOARD-MORNING-SETUP
12. `[-]` Part of the coaching process is doing this each day. It gives us two things. First, it's a real quick check-in on how your state is, which is valuable, and people don't usually do it enough. And second, over time it lets us see the connection between your behavior and your state. So when would you like to do this each morning? I recommend 15 minutes after you wake up.
13. `[-]` Every single day is great. But doing weekdays consistently is better than every day inconsistently. So that's what I recommend to start. But you're welcome to add the weekend as well.

### ONBOARD-FORK--FORM
14. `[-]` *(lead-in)* For the next part of the process, I'd like to know:
15. `[fork_question]` Do you already track habits or is this new to you?

### ONBOARD-BEGINNER-01
16. `[-]` Let's choose one area of your life that you'd like to improve on. Here are our recommended categories.
17. `[create_your_own]` Or you can create your own.

### ONBOARD-BEGINNER-02
18. `[opener]` So within that, which goals would you like to start with? Pick one or two.

### ONBOARD-BEGINNER-02-CUSTOM
19. `[opener]` Tell me the goal you want to add, and I'll set it up.

### ONBOARD-BEGINNER-03
20. `[opener]` Pick one or two habits that feel doable. One habit that you actually keep is much better than a list of five that you don't keep. Create your own if nothing here fits.

### ONBOARD-BEGINNER-03-CUSTOM
21. `[opener]` Tell me the habit you want to add, and I'll set it up.

### ONBOARD-BEGINNER-04
22. `[-]` Please set the days that you're going to actually do these habits.
23. `[-]` Not every habit needs to be done every day. Three specific days in the week is great as well. Once a week for specific habits, also great.

### ONBOARD-BEGINNER-07
24. `[-]` One more. An evening reflection, a couple of minutes to close out your day. Use these three questions.
25. `[reflect_proud]` What am I proud of?
26. `[reflect_forgive]` What do I forgive myself for?
27. `[reflect_grateful]` What am I grateful for?
28. `[reflect_alt]` Or make your own, or just talk freely.
29. `[reflect_time]` I'd recommend doing this before bed, maybe 15 minutes before you wind down.

### ONBOARD-ADVANCED
30. `[opener]` Read me the list of the habits that you already track. In the next step we'll talk about which days. For now just give me the list of your habits. I recommend to start small. You could always build on it.
31. `[close]` Those are all in, and I marked each as build or break. Tell me if any look wrong. If they're good, we'll set the days next.

### ONBOARD-ADVANCED-FREQUENCY
32. `[-]` Not every habit needs to be done every day. Specific days in the week is great as well. Once a week for a certain habit, also great.
33. `[-]` Your habits are all set, your plan is ready.

### ONBOARD-COMPLETE
34. `[opener]` Here's your plan. Your check-in, your reflection, and the habits you picked. Want to start here, or change anything first?

### ONBOARD-WEEKLY-PROJECTION-BLANK
35. `[opener]` This is your week. Blank, starting today.

### ONBOARD-WEEKLY-PROJECTION-FULL
36. `[opener]` Best case, every day green. 100% success. That would be amazing.

### ONBOARD-WEEKLY-PROJECTION-P78
37. `[opener]` Most likely your week looks somewhere around here. Mostly green, a few misses. Still a real win.

### ONBOARD-WEEKLY-PROJECTION-P36
38. `[opener]` Some weeks can look like this. And even that's okay, because you're in the process and you're consistent inside the process.

### ONBOARD-WEEKLY-PROJECTION-GAPS
39. `[opener]` The one thing you want to avoid is this. The empty days you never reported. Stay consistent, just report it. Even a miss counts. That keeps the momentum going.

---
**39 lines total** · 1 live (name), 38 pre-rendered clips · 1 redundant line dropped.