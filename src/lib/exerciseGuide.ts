// Short, original coaching cues for every exercise, shown under the demo.
export const EXERCISE_GUIDE: Record<string, string[]> = {
  // Chest
  'bb-bench': [
    'Lie on the bench with your eyes under the bar and feet flat on the floor.',
    'Grip just wider than your shoulders, squeeze your shoulder blades together and unrack.',
    'Lower the bar to your lower chest with elbows about 45° from your body.',
    'Press back up until your arms are straight, keeping your back and feet still.',
  ],
  'bb-incline-bench': [
    'Set the bench to about 30° and lie back with your feet flat.',
    'Grip just wider than your shoulders and unrack over your upper chest.',
    'Lower the bar to just below your collarbone.',
    'Press straight up until your arms lock out.',
  ],
  'db-bench': [
    'Sit with the dumbbells on your thighs, then lie back and bring them to your chest.',
    'Start with the dumbbells beside your chest, palms facing your feet.',
    'Press up until your arms are straight and the dumbbells almost touch.',
    'Lower slowly until you feel a stretch across your chest.',
  ],
  'db-incline-bench': [
    'Set the bench to about 30° and lie back with a dumbbell in each hand at chest height.',
    'Press up and slightly in until your arms are straight.',
    'Lower under control until your elbows are just below the bench.',
  ],
  'db-fly': [
    'Lie on a flat bench holding the dumbbells above your chest, palms facing each other.',
    'Keep a soft bend in your elbows and open your arms in a wide arc.',
    'Stop when you feel a deep stretch in your chest, then hug the weights back together.',
  ],
  'machine-chest-press': [
    'Set the seat so the handles line up with the middle of your chest.',
    'Sit tall with your back against the pad and grip the handles.',
    'Press forward until your arms are straight, then return slowly.',
  ],
  'pec-deck': [
    'Set the seat so your elbows are level with your shoulders.',
    'Place your forearms on the pads with your back flat against the seat.',
    'Squeeze the pads together in front of your chest, pause, then open slowly.',
  ],
  'cable-fly': [
    'Set both pulleys high and hold a handle in each hand, one step in front of the stack.',
    'Lean forward slightly with a soft bend in your elbows.',
    'Bring your hands together in a wide arc in front of your hips, then return slowly.',
  ],
  'push-up': [
    'Start in a high plank with your hands just wider than your shoulders.',
    'Keep a straight line from head to heels and brace your stomach.',
    'Lower until your chest is just above the floor, elbows about 45° from your body.',
    'Push the floor away until your arms are straight.',
  ],
  dip: [
    'Support yourself on the bars with straight arms and your feet off the floor.',
    'Lean slightly forward and lower until your shoulders are just below your elbows.',
    'Press back up until your arms are straight.',
  ],
  // Back
  deadlift: [
    'Stand with the bar over the middle of your feet, feet hip-width apart.',
    'Hinge down and grip just outside your legs, shins touching the bar.',
    'Brace, flatten your back and push the floor away to stand up tall.',
    'Lower the bar by pushing your hips back, keeping it close to your legs.',
  ],
  'bb-row': [
    'Hold the bar with an overhand grip and hinge forward until your torso is nearly flat.',
    'Keep your back flat and knees soft.',
    'Pull the bar to your lower ribs, squeezing your shoulder blades together.',
    'Lower it under control until your arms are straight.',
  ],
  'db-row': [
    'Put one knee and the same-side hand on a bench, back flat.',
    'Hold a dumbbell in the other hand with your arm straight.',
    'Pull the dumbbell to your hip, keeping your elbow close to your body.',
    'Lower slowly and repeat, then switch sides.',
  ],
  'pull-up': [
    'Hang from the bar with an overhand grip just wider than your shoulders.',
    'Pull your shoulders down and back, then pull until your chin clears the bar.',
    'Lower all the way to straight arms without swinging.',
  ],
  'chin-up': [
    'Hang from the bar with palms facing you, hands shoulder-width apart.',
    'Pull until your chin clears the bar, leading with your chest.',
    'Lower slowly to straight arms.',
  ],
  'lat-pulldown': [
    'Sit with your thighs under the pads and grip the bar wider than your shoulders.',
    'Lean back slightly and pull the bar to your upper chest.',
    'Squeeze your back, then let the bar rise slowly until your arms are straight.',
  ],
  'seated-cable-row': [
    'Sit with your feet on the platform, knees soft, holding the handle with straight arms.',
    'Sit tall and pull the handle to your stomach, squeezing your shoulder blades.',
    'Let your arms extend slowly without rounding your back.',
  ],
  'machine-row': [
    'Set the seat so the handles are at chest height and rest your chest on the pad.',
    'Pull the handles back, driving your elbows behind you.',
    'Pause, then return slowly to straight arms.',
  ],
  'kb-swing': [
    'Stand with feet wider than hips and the kettlebell a step in front of you.',
    'Hinge down, grab the handle and hike it back between your legs.',
    'Snap your hips forward to swing the bell to chest height, arms relaxed.',
    'Let it fall back between your legs and go straight into the next rep.',
  ],
  'band-pull-apart': [
    'Hold a band in front of your chest with straight arms, hands shoulder-width apart.',
    'Pull the band apart until it touches your chest, squeezing your shoulder blades.',
    'Return slowly with control.',
  ],
  // Shoulders
  ohp: [
    'Hold the bar at your collarbone with hands just wider than your shoulders.',
    'Squeeze your glutes and brace your stomach.',
    'Press the bar straight up, moving your head back slightly to let it pass.',
    'Lock out overhead with the bar over your mid-foot, then lower to your collarbone.',
  ],
  'db-shoulder-press': [
    'Sit tall on an upright bench with dumbbells at shoulder height, palms forward.',
    'Press up until your arms are straight overhead.',
    'Lower slowly back to shoulder height.',
  ],
  'machine-shoulder-press': [
    'Set the seat so the handles are at shoulder height.',
    'Sit tall with your back against the pad and press until your arms are straight.',
    'Lower slowly until your hands are back at shoulder height.',
  ],
  'db-lateral-raise': [
    'Stand tall with a dumbbell in each hand at your sides.',
    'With a slight bend in your elbows, raise your arms out to the side.',
    'Stop at shoulder height, then lower slowly.',
  ],
  'cable-lateral-raise': [
    'Stand side-on to a low pulley and hold the handle in the far hand.',
    'Raise your arm out to the side until it reaches shoulder height.',
    'Lower slowly, keeping tension on the cable. Switch sides.',
  ],
  'face-pull': [
    'Set a rope at upper-chest height and hold each end, palms facing in.',
    'Step back until your arms are straight.',
    'Pull the rope towards your face, spreading the ends and lifting your elbows high.',
    'Return slowly to straight arms.',
  ],
  'reverse-fly': [
    'Hinge forward with a flat back, holding light dumbbells under your chest.',
    'With a slight bend in your elbows, raise your arms out to the side.',
    'Squeeze your shoulder blades at the top, then lower slowly.',
  ],
  'kb-press': [
    'Hold the kettlebell at your shoulder with the bell resting on your forearm.',
    'Brace your stomach and press straight up until your arm is locked out.',
    'Lower slowly back to your shoulder. Switch sides.',
  ],
  // Arms
  'bb-curl': [
    'Stand tall holding the bar with palms forward, hands shoulder-width apart.',
    'Keep your elbows at your sides and curl the bar towards your shoulders.',
    'Lower slowly until your arms are straight.',
  ],
  'db-curl': [
    'Stand with a dumbbell in each hand, palms forward.',
    'Curl the weights up without moving your elbows forward.',
    'Squeeze at the top, then lower slowly.',
  ],
  'hammer-curl': [
    'Stand with a dumbbell in each hand, palms facing your body.',
    'Keep that grip and curl the weights towards your shoulders.',
    'Lower slowly until your arms are straight.',
  ],
  'cable-curl': [
    'Attach a bar to a low pulley and hold it with palms up.',
    'Stand tall with your elbows at your sides and curl the bar up.',
    'Lower slowly, keeping tension on the cable.',
  ],
  'band-curl': [
    'Stand on the middle of the band and hold one end in each hand, palms forward.',
    'Keep your elbows at your sides and curl your hands towards your shoulders.',
    'Lower slowly against the band.',
  ],
  'close-grip-bench': [
    'Lie on a flat bench and grip the bar about shoulder-width apart.',
    'Lower the bar to your lower chest, keeping your elbows close to your body.',
    'Press back up until your arms are straight.',
  ],
  'skull-crusher': [
    'Lie on a flat bench holding the bar above your chest with straight arms.',
    'Keep your upper arms still and bend at the elbows to lower the bar towards your forehead.',
    'Extend your arms to press the bar back up.',
  ],
  'triceps-pushdown': [
    'Face a high pulley and hold the bar or rope with your elbows at your sides.',
    'Push down until your arms are straight, without moving your elbows.',
    'Let your forearms rise slowly to about chest height.',
  ],
  'overhead-triceps-ext': [
    'Hold one dumbbell with both hands straight above your head.',
    'Keep your elbows pointing up and lower the weight behind your head.',
    'Straighten your arms to lift it back up.',
  ],
  'band-pushdown': [
    'Anchor a band high and hold it with your elbows at your sides.',
    'Push down until your arms are straight.',
    'Let your hands rise slowly to chest height.',
  ],
  // Legs
  'back-squat': [
    'Rest the bar on your upper back and stand with feet about shoulder-width apart.',
    'Brace your stomach, then sit down and back between your heels.',
    'Go as low as you can with a flat back, ideally thighs below parallel.',
    'Drive up through your whole foot to stand tall.',
  ],
  'front-squat': [
    'Rest the bar on the front of your shoulders with your elbows high.',
    'Keep your chest up and squat straight down between your heels.',
    'Drive back up, keeping your elbows high the whole way.',
  ],
  rdl: [
    'Stand tall holding the bar at your thighs, knees slightly bent.',
    'Push your hips back and slide the bar down your legs, keeping your back flat.',
    'Stop when you feel a strong stretch in your hamstrings.',
    'Drive your hips forward to stand back up.',
  ],
  'hip-thrust': [
    'Sit with your upper back against a bench and a padded bar over your hips.',
    'Plant your feet so your shins are vertical at the top.',
    'Drive through your heels to lift your hips until your body is flat from knees to shoulders.',
    'Squeeze your glutes, then lower slowly.',
  ],
  'goblet-squat': [
    'Hold a dumbbell upright against your chest.',
    'Squat down between your heels, keeping your chest up.',
    'Push your knees out at the bottom, then stand back up.',
  ],
  'db-rdl': [
    'Stand with a dumbbell in each hand in front of your thighs.',
    'Push your hips back and lower the weights along your legs with a flat back.',
    'Stand up by driving your hips forward.',
  ],
  'bulgarian-split-squat': [
    'Stand a long step in front of a bench and rest the top of your back foot on it.',
    'Hold dumbbells at your sides and lower straight down until your back knee nearly touches the floor.',
    'Push through your front foot to stand up. Switch legs.',
  ],
  'db-lunge': [
    'Stand tall with a dumbbell in each hand.',
    'Take a long step and lower until both knees are bent about 90°.',
    'Push through your front foot and step into the next lunge.',
  ],
  'leg-press': [
    'Sit with your back flat on the pad and feet shoulder-width on the platform.',
    'Release the safeties and lower the platform until your knees are bent about 90°.',
    'Press back up without locking your knees.',
  ],
  'hack-squat': [
    'Stand on the platform with your back and shoulders against the pads.',
    'Release the safeties and squat down as low as is comfortable.',
    'Drive through your feet to stand back up.',
  ],
  'leg-extension': [
    'Sit with the pad on the front of your ankles and your knees in line with the machine pivot.',
    'Straighten your legs fully and squeeze your thighs.',
    'Lower slowly.',
  ],
  'lying-leg-curl': [
    'Lie face down with the pad just above your heels.',
    'Curl your heels towards your glutes, keeping your hips down.',
    'Lower slowly until your legs are straight.',
  ],
  'seated-leg-curl': [
    'Sit with the pad behind your ankles and the thigh pad snug on your legs.',
    'Curl your heels down and back as far as you can.',
    'Return slowly to straight legs.',
  ],
  'cable-pull-through': [
    'Face away from a low pulley and hold the rope between your legs.',
    'Walk forward a step or two, then hinge your hips back with a flat back.',
    'Drive your hips forward to stand tall, squeezing your glutes.',
  ],
  'kb-goblet-squat': [
    'Hold the kettlebell by the horns against your chest.',
    'Squat down between your heels, keeping your chest up.',
    'Stand back up by pushing through your whole foot.',
  ],
  'bw-squat': [
    'Stand with feet about shoulder-width apart.',
    'Reach your arms forward and sit down and back as low as you can.',
    'Stand back up, squeezing your glutes at the top.',
  ],
  'glute-bridge': [
    'Lie on your back with knees bent and feet flat, close to your hips.',
    'Push through your heels to lift your hips until your body is straight from knees to shoulders.',
    'Squeeze your glutes, then lower slowly.',
  ],
  'band-squat': [
    'Stand on the band with feet shoulder-width apart and hold the ends at your shoulders.',
    'Squat down, keeping your chest up and knees pushing out.',
    'Stand up against the band.',
  ],
  'standing-calf-raise': [
    'Stand with the balls of your feet on the platform and the pads on your shoulders.',
    'Lower your heels as far as you can for a stretch.',
    'Rise up onto your toes as high as you can, then lower slowly.',
  ],
  'seated-calf-raise': [
    'Sit with the balls of your feet on the platform and the pad on your knees.',
    'Lower your heels for a stretch.',
    'Push up onto your toes as high as you can, then lower slowly.',
  ],
  'db-calf-raise': [
    'Stand tall with a dumbbell in each hand, the balls of your feet on a step if you have one.',
    'Rise up onto your toes as high as you can.',
    'Lower slowly until your heels are below the step.',
  ],
  'bw-calf-raise': [
    'Stand on one foot on a step, holding something for balance.',
    'Rise as high as you can onto your toes.',
    'Lower slowly for a full stretch. Switch legs.',
  ],
  // Core
  plank: [
    'Rest on your forearms with your elbows under your shoulders.',
    'Lift your hips so your body is straight from head to heels.',
    'Brace your stomach and squeeze your glutes. Hold without letting your hips sag.',
  ],
  'hanging-leg-raise': [
    'Hang from a bar with straight arms.',
    'Brace and raise your legs until your thighs are at least level with your hips.',
    'Lower slowly without swinging.',
  ],
  'cable-crunch': [
    'Kneel facing a high pulley and hold the rope beside your head.',
    'Crunch down by curling your ribs towards your hips, keeping your hips still.',
    'Return slowly to upright.',
  ],
  'ab-wheel': [
    'Kneel holding the wheel under your shoulders.',
    'Brace and roll forward as far as you can without your lower back sagging.',
    'Pull the wheel back in with your stomach muscles.',
  ],
  'pallof-press': [
    'Stand side-on to a pulley set at chest height and hold the handle at your chest.',
    'Press the handle straight out in front of you and resist being pulled sideways.',
    'Bring it back to your chest. Switch sides.',
  ],
  'kb-farmer-carry': [
    'Pick up a heavy kettlebell in each hand.',
    'Stand tall with your shoulders back and stomach braced.',
    'Walk with short, steady steps for the set distance or time.',
  ],
};
