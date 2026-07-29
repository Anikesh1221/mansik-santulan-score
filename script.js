/* =====================================================================
   MindScope — script.js
   Handles: field validation, Fetch API prediction call,
            animated result reveal (ring + counter), confetti celebration.
   ===================================================================== */

(() => {
  'use strict';

  // -------------------------------------------------------------
  // Config
  // https://mansik-santulan-score-jgvr.onrender.com
  // -------------------------------------------------------------
  const API_ENDPOINT = "https://mansik-santulan-score-jgvr.onrender.com/predict";
  const HIGH_SCORE_THRESHOLD = 7.5; // confetti fires at/above this score

  // -------------------------------------------------------------
  // Element references
  // -------------------------------------------------------------
  const form = document.getElementById('predict-form-el');
  const predictBtn = document.getElementById('predict-btn');
  const formStatus = document.getElementById('form-status');

  const resultCard = document.getElementById('result-card');
  const scoreNumberEl = document.getElementById('score-number');
  const scoreRingProgress = document.getElementById('score-ring-progress');
  const scoreLabelEl = document.getElementById('score-label');
  const scoreDescEl = document.getElementById('score-description');
  const retakeBtn = document.getElementById('retake-btn');

  const confettiCanvas = document.getElementById('confetti-canvas');

  // Ring circumference: 2 * PI * r(96) — matches the CSS stroke-dasharray
  const RING_CIRCUMFERENCE = 2 * Math.PI * 96;

  // -------------------------------------------------------------
  // Field definitions used for validation
  // Each entry maps an input id -> validation rule + error id
  // -------------------------------------------------------------
  const fields = [
    { id: 'age', errId: 'err-age', type: 'number', min: 5, max: 100, label: 'age' },
    { id: 'gender', errId: 'err-gender', type: 'select', label: 'gender' },
    { id: 'country', errId: 'err-country', type: 'select', label: 'country' },
    { id: 'academic-level', errId: 'err-academic-level', type: 'select', label: 'academic level' },
    { id: 'platform', errId: 'err-platform', type: 'select', label: 'platform' },
    { id: 'purpose', errId: 'err-purpose', type: 'select', label: 'purpose of use' },
    { id: 'usage-hours', errId: 'err-usage-hours', type: 'number', min: 0, max: 24, label: 'daily usage hours' },
    { id: 'unlocks', errId: 'err-unlocks', type: 'number', min: 0, max: 300, label: 'daily unlocks' },
    { id: 'activity-hours', errId: 'err-activity-hours', type: 'number', min: 0, max: 24, label: 'physical activity hours' },
    { id: 'sleep-hours', errId: 'err-sleep-hours', type: 'number', min: 0, max: 24, label: 'sleep hours' },
    { id: 'study-hours', errId: 'err-study-hours', type: 'number', min: 0, max: 24, label: 'study hours' },
    { id: 'stress-level', errId: 'err-stress-level', type: 'select', label: 'stress level' },
  ];

  // -------------------------------------------------------------
  // Validation helpers
  // -------------------------------------------------------------
  function clearFieldError(inputEl, errEl) {
    inputEl.closest('.field').classList.remove('has-error');
    errEl.textContent = '';
  }

  function setFieldError(inputEl, errEl, message) {
    inputEl.closest('.field').classList.add('has-error');
    errEl.textContent = message;
  }

  function validateField(fieldDef) {
    const inputEl = document.getElementById(fieldDef.id);
    const errEl = document.getElementById(fieldDef.errId);
    const rawValue = inputEl.value;

    clearFieldError(inputEl, errEl);

    if (rawValue === '' || rawValue === null) {
      setFieldError(inputEl, errEl, `Please provide your ${fieldDef.label}.`);
      return false;
    }

    if (fieldDef.type === 'number') {
      const numValue = Number(rawValue);
      if (Number.isNaN(numValue)) {
        setFieldError(inputEl, errEl, `${capitalize(fieldDef.label)} must be a number.`);
        return false;
      }
      if (numValue < fieldDef.min || numValue > fieldDef.max) {
        setFieldError(inputEl, errEl, `Enter a value between ${fieldDef.min} and ${fieldDef.max}.`);
        return false;
      }
    }

    return true;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function validateAllFields() {
    let isValid = true;
    fields.forEach((fieldDef) => {
      const fieldValid = validateField(fieldDef);
      if (!fieldValid) isValid = false;
    });
    return isValid;
  }

  // Clear a field's error state as soon as the user starts fixing it
  fields.forEach((fieldDef) => {
    const inputEl = document.getElementById(fieldDef.id);
    const eventName = fieldDef.type === 'select' ? 'change' : 'input';
    inputEl.addEventListener(eventName, () => validateField(fieldDef));
  });

  // -------------------------------------------------------------
  // Build the JSON payload expected by the API
  // -------------------------------------------------------------
  function buildPayload() {
    return {
      Age: Number(document.getElementById('age').value),
      Gender: document.getElementById('gender').value,
      country: document.getElementById('country').value,
      Academic_Level: document.getElementById('academic-level').value,
      Most_Used_Platform: document.getElementById('platform').value,
      Purpose_Of_Use: document.getElementById('purpose').value,
      Avg_Daily_Usage_Hours: Number(document.getElementById('usage-hours').value),
      Daily_Unlocks: Number(document.getElementById('unlocks').value),
      Physical_Activity_Hours: Number(document.getElementById('activity-hours').value),
      Sleep_Hours_Per_Night: Number(document.getElementById('sleep-hours').value),
      Study_Hours: Number(document.getElementById('study-hours').value),
      Stress_Level: document.getElementById('stress-level').value,
    };
  }

  // -------------------------------------------------------------
  // Loading state on the submit button
  // -------------------------------------------------------------
  function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    predictBtn.classList.toggle('is-loading', isLoading);
  }

  // -------------------------------------------------------------
  // Result rendering: animated ring + counting number
  // -------------------------------------------------------------
  function describeScore(score) {
    if (score >= 8) {
      return {
        label: 'Thriving',
        desc: 'Your habits point to a strong, well-balanced baseline. Keep protecting your sleep and downtime.',
      };
    }
    if (score >= 6) {
      return {
        label: 'Steady',
        desc: 'You\u2019re in a reasonably healthy range, with some room to dial back screen time or stress.',
      };
    }
    if (score >= 4) {
      return {
        label: 'Needs attention',
        desc: 'A few areas — sleep, activity or stress — may be pulling your score down. Small changes can help.',
      };
    }
    return {
      label: 'At risk',
      desc: 'Your inputs suggest real strain. Consider talking to someone you trust or a mental health professional.',
    };
  }

  function animateCounter(targetValue, durationMs = 1400) {
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic for a premium deceleration feel
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = (targetValue * eased).toFixed(2);
      scoreNumberEl.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        scoreNumberEl.textContent = targetValue.toFixed(2);
      }
    }

    requestAnimationFrame(tick);
  }

  function renderResult(score) {
    const clampedScore = Math.max(0, Math.min(10, score));

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Animate the ring stroke
    const offset = RING_CIRCUMFERENCE * (1 - clampedScore / 10);
    // Force reflow so the transition reliably triggers from the full offset
    scoreRingProgress.style.transition = 'none';
    scoreRingProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;
    // eslint-disable-next-line no-unused-expressions
    scoreRingProgress.getBoundingClientRect();
    scoreRingProgress.style.transition = '';
    requestAnimationFrame(() => {
      scoreRingProgress.style.strokeDashoffset = offset;
    });

    // Animate the big number
    animateCounter(clampedScore);

    // Label + description
    const { label, desc } = describeScore(clampedScore);
    scoreLabelEl.textContent = label;
    scoreDescEl.textContent = desc;

    if (clampedScore >= HIGH_SCORE_THRESHOLD) {
      launchConfetti();
    }
  }

  // -------------------------------------------------------------
  // Confetti: lightweight canvas particle burst, high scores only
  // -------------------------------------------------------------
  function launchConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    confettiCanvas.style.width = `${window.innerWidth}px`;
    confettiCanvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);

    const colors = ['#8b7bff', '#5ec8ff', '#33e6c9', '#ff8a7a'];
    const particleCount = 140;
    const particles = Array.from({ length: particleCount }, () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1.6) * 14,
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.28 + Math.random() * 0.12,
      life: 1,
    }));

    const startTime = performance.now();
    const durationMs = 2600;

    function frame(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach((p) => {
        p.vy += p.gravity * 0.05;
        p.x += p.vx * 0.6;
        p.y += p.vy * 0.6;
        p.rotation += p.rotationSpeed;
        p.life = Math.max(0, 1 - elapsed / durationMs);

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      });

      if (elapsed < durationMs) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    requestAnimationFrame(frame);
  }

  // -------------------------------------------------------------
  // Form submission
  // -------------------------------------------------------------
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formStatus.textContent = '';
    formStatus.classList.remove('is-info');

    const isValid = validateAllFields();
    if (!isValid) {
      formStatus.textContent = 'Please fix the highlighted fields before continuing.';
      const firstError = form.querySelector('.field.has-error input, .field.has-error select');
      if (firstError) firstError.focus();
      return;
    }

    const payload = buildPayload();
    setLoading(true);
    formStatus.classList.add('is-info');
    formStatus.textContent = 'Analysing your responses…';

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const score = Number(data.predicted_mental_healthScore);

      if (Number.isNaN(score)) {
        throw new Error('Unexpected response shape from prediction service.');
      }

      formStatus.textContent = '';
      renderResult(score);
    } catch (error) {
      formStatus.classList.remove('is-info');
      formStatus.textContent =
        'Couldn\u2019t reach the prediction service. Make sure the API is running and try again.';
      // eslint-disable-next-line no-console
      console.error('Prediction request failed:', error);
    } finally {
      setLoading(false);
    }
  });

  // -------------------------------------------------------------
  // Retake: hide result, scroll back to form, reset button states
  // -------------------------------------------------------------
  retakeBtn.addEventListener('click', () => {
    resultCard.hidden = true;
    document.getElementById('predict-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
