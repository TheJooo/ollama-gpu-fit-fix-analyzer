import { analyzeDiagnostic, RULE_PACK_VERSION } from './analyzer.js';

const input = document.querySelector('#diagnostic');
const preview = document.querySelector('#preview');
const result = document.querySelector('#result');
const form = document.querySelector('#analyzer-form');
const clear = document.querySelector('#clear');

function render(report) {
  preview.textContent = report.sanitized || 'Nothing to preview yet.';
  const facts = report.facts.length ? `<ul>${report.facts.map(f => `<li><strong>${f.label}:</strong> ${escapeHtml(f.value)}</li>`).join('')}</ul>` : '<p>No facts could be safely observed.</p>';
  const cards = report.diagnoses.map(d => `<article class="card"><p class="confidence">${escapeHtml(d.confidence)}</p><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.detail)}</p>${d.fixes.length ? `<h4>Ordered fix</h4><ol>${d.fixes.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>` : ''}<h4>Verify</h4><p>${escapeHtml(d.verification[0])}</p><p class="sources">${d.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a> (retrieved ${s.retrieved})`).join(', ')}</p></article>`).join('');
  result.innerHTML = `<h2>Local diagnostic report</h2><h3>Observed facts</h3>${facts}<h3>Diagnoses</h3>${cards}<p class="muted">Rule pack ${report.rulePack}. Conclusions are limited to the pasted evidence.</p>`;
  result.hidden = false;
}
function escapeHtml(value) { const e = document.createElement('span'); e.textContent = value; return e.innerHTML; }
function updatePreview() { preview.textContent = input.value ? analyzeDiagnostic(input.value).sanitized : 'Nothing to preview yet.'; }
form.addEventListener('submit', event => { event.preventDefault(); render(analyzeDiagnostic(input.value)); });
input.addEventListener('input', updatePreview);
clear.addEventListener('click', () => { form.reset(); preview.textContent = 'Nothing to preview yet.'; result.hidden = true; input.focus(); });
document.querySelector('#rule-pack').textContent = RULE_PACK_VERSION;
