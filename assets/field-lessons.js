import { lessons } from './field-lessons-data.js';

const notebookKey = 'long-march:field-note:';

export function createFieldGuide(root, stations, returnToScene) {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./field-lessons.css', import.meta.url).href;
  document.head.append(stylesheet);

  const portrait = new URL('./valley/recorder-portrait.webp', import.meta.url).href;
  const drafts = new Map();
  const sessionNotes = new Map();
  const answers = new Map();

  function readNote(id) {
    if (sessionNotes.has(id)) return sessionNotes.get(id);
    try {
      return localStorage.getItem(notebookKey + id) || '';
    } catch {
      return '';
    }
  }

  root.className = 'field-guide';

  return function renderFieldLesson(station) {
    const lesson = lessons[station.id];
    root.innerHTML = `
      <header class="field-guide-header">
        <img src="${portrait}" width="52" height="52" alt="" decoding="async">
        <div>
          <p>行记员 <span>虚构角色</span></p>
          <h3>${lesson.title}</h3>
        </div>
      </header>
      <section class="field-step">
        <h4>看现场</h4>
        <p>${lesson.look}</p>
        <button type="button" class="field-return">回看现场 <span aria-hidden="true">↗</span></button>
      </section>
      <section class="field-step">
        <h4>找证据</h4>
        ${lesson.evidence.map(([label, summary, source, url], index) => `
          <details class="field-material">
            <summary><span aria-hidden="true">${index + 1}</span>${label}</summary>
            <p>${summary}</p>
            <a href="${url}" target="_blank" rel="noopener">${source} <span class="field-external" aria-label="（在新标签页打开）">↗</span></a>
          </details>`).join('')}
      </section>
      <fieldset class="field-step field-judgment">
        <legend>作判断</legend>
        <p id="fieldQuestion">${lesson.question}</p>
        <div role="group" aria-labelledby="fieldQuestion" class="field-choices">
          ${lesson.choices.map(([label], index) => `
            <button type="button" data-choice="${index}" aria-pressed="false">${label}</button>`).join('')}
        </div>
        <p class="field-feedback" role="status" aria-atomic="true"></p>
      </fieldset>
      <section class="field-step">
        <h4>复盘</h4>
        <form class="field-note-form">
          <label for="fieldNote">${lesson.reflection}</label>
          <textarea id="fieldNote" rows="3" maxlength="300" aria-describedby="fieldNoteHelp"></textarea>
          <p class="field-note-help" id="fieldNoteHelp">最多 300 字，行记保存在当前浏览器。</p>
          <div class="field-note-actions">
            <button type="submit">保存本站行记</button>
            <p class="field-note-status" role="status" aria-atomic="true"></p>
          </div>
        </form>
        <details class="field-notebook">
          <summary>我的行记 <span class="field-note-count"></span></summary>
          <div class="field-notebook-entries"></div>
        </details>
        <details class="field-material field-visit">
          <summary>延伸参访</summary>
          <p></p>
        </details>
      </section>`;

    root.querySelector('.field-visit p').textContent = station.base;
    root.querySelector('.field-return').addEventListener('click', returnToScene);
    const feedback = root.querySelector('.field-feedback');
    const choices = root.querySelectorAll('[data-choice]');
    const textarea = root.querySelector('textarea');
    const noteStatus = root.querySelector('.field-note-status');
    const entries = root.querySelector('.field-notebook-entries');
    const count = root.querySelector('.field-note-count');
    textarea.value = drafts.get(station.id) ?? readNote(station.id);

    function showAnswer(index) {
      const correct = index === lesson.answer;
      choices.forEach((button, option) => button.setAttribute('aria-pressed', String(option === index)));
      feedback.dataset.correct = String(correct);
      feedback.textContent = (correct ? '判断有据。' : '再对照材料。') + lesson.choices[index][1];
    }

    for (const button of choices) {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.choice);
        answers.set(station.id, index);
        showAnswer(index);
      });
    }
    if (answers.has(station.id)) showAnswer(answers.get(station.id));

    function renderNotebook() {
      const recorded = stations.flatMap(item => {
        const note = readNote(item.id);
        if (!note) return [];
        const entry = document.createElement('article');
        const link = document.createElement('a');
        link.href = '#station/' + item.id + '/study';
        link.textContent = item.name;
        const text = document.createElement('p');
        text.textContent = note;
        entry.append(link, text);
        return [entry];
      });
      count.textContent = recorded.length + ' / ' + stations.length + ' 站';
      if (recorded.length) {
        entries.replaceChildren(...recorded);
      } else {
        const empty = document.createElement('p');
        empty.textContent = '保存一条行记后，可以在这里回看。';
        entries.replaceChildren(empty);
      }
    }

    textarea.addEventListener('input', () => {
      drafts.set(station.id, textarea.value);
      noteStatus.textContent = '有未保存的修改';
    });
    root.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const note = textarea.value.trim();
      if (!note) {
        noteStatus.textContent = '请先写下一条行记。';
        textarea.focus();
        return;
      }
      try {
        localStorage.setItem(notebookKey + station.id, note);
        sessionNotes.delete(station.id);
        noteStatus.textContent = '已保存';
      } catch {
        sessionNotes.set(station.id, note);
        noteStatus.textContent = '已暂存，刷新后会清除。';
      }
      textarea.value = note;
      drafts.delete(station.id);
      renderNotebook();
    });
    renderNotebook();
  };
}
