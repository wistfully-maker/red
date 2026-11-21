import { peopleNotes, peopleThemes } from './people-notes-data.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function disclosure(label, ...children) {
  const details = element('details', 'people-disclosure');
  details.append(element('summary', '', label), ...children);
  return details;
}

export function createPeopleNotes(overview, stations) {
  const stylesheet = element('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./people-notes.css', import.meta.url).href;
  document.head.append(stylesheet);

  const root = element('section', 'people-notes');
  root.hidden = true;
  root.setAttribute('aria-labelledby', 'peopleNoteTitle');
  overview.before(root);

  return {
    root,
    render(station) {
      const note = peopleNotes[station.id];
      const heading = element('h3', '', note.title);
      heading.id = 'peopleNoteTitle';
      const opening = element('header', 'people-card');
      opening.append(element('p', 'people-byline', '行记员 · ' + peopleThemes[note.theme]), heading,
        element('p', 'people-subject', note.subject), element('p', 'people-note', note.note));

      const sources = element('ul', 'people-sources');
      for (const [label, url] of note.sources) {
        const item = element('li');
        const link = element('a', '', label);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        item.append(link);
        sources.append(item);
      }
      const evidence = disclosure('出处与复原边界', element('p', 'people-boundary', note.boundary), sources);

      const filter = element('select');
      filter.id = 'peopleTheme';
      filter.replaceChildren(...Object.entries(peopleThemes).map(([id, name]) => new Option(name, id)));
      filter.value = note.theme;
      const label = element('label', 'people-theme-filter', '选择主题');
      label.htmlFor = filter.id;
      label.append(filter);
      const links = element('ul', 'people-theme-links');
      const themes = disclosure('串读六条人文线索', label, links);

      const renderTheme = () => {
        const linked = stations.filter(candidate => peopleNotes[candidate.id].theme === filter.value);
        links.replaceChildren(...linked.map(candidate => {
          const current = station.id === candidate.id;
          const item = element('li');
          const entry = element(current ? 'span' : 'a', 'people-theme-entry');
          if (current) entry.setAttribute('aria-current', 'location');
          else entry.href = '#station/' + candidate.id + '/people';
          entry.append(element('strong', '', candidate.name), element('small', '', peopleNotes[candidate.id].subject));
          item.append(entry);
          return item;
        }));
      };
      filter.addEventListener('change', renderTheme);
      renderTheme();

      overview.textContent = station.people;
      const additional = disclosure('本站人物速览', overview);
      root.replaceChildren(opening, evidence, themes, additional);
    },
  };
}
