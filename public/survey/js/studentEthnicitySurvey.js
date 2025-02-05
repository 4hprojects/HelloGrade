// DOM references
const yearLevelSelect = document.getElementById('yearLevel');
const yearLevelOther  = document.getElementById('yearLevelOther');
const sectionSelect   = document.getElementById('section');
const sectionOther    = document.getElementById('sectionOther');
const degreeSelect    = document.getElementById('degree');
const degreeOther     = document.getElementById('degreeOther');

const nationalitySelect      = document.getElementById('nationalitySelect');
const otherNationality       = document.getElementById('otherNationality');

const filipinoEthnicitySection = document.getElementById('filipinoEthnicitySection');
const nonFilipinoEthnicity     = document.getElementById('nonFilipinoEthnicity');

const ethnicityCheckboxes  = document.getElementById('ethnicityCheckboxes');

// 1) Show/hide "Others" text field
function handleOthers(selectElement, textElement) {
  if (selectElement.value === 'Others') {
    textElement.classList.remove('hidden');
    textElement.setAttribute('required', 'true');
  } else {
    textElement.classList.add('hidden');
    textElement.removeAttribute('required');
    textElement.value = '';
  }
}

// 2) Nationality Change => Toggle Filipino vs. Other
function handleNationalityChange() {
  if (nationalitySelect.value === 'Filipino') {
    otherNationality.classList.add('hidden');
    otherNationality.removeAttribute('required');
    otherNationality.value = '';

    filipinoEthnicitySection.classList.remove('hidden');
    nonFilipinoEthnicity.classList.add('hidden');
    document.getElementById('nonFilipino').value = '';
  } else if (nationalitySelect.value === 'Other') {
    otherNationality.classList.remove('hidden');
    otherNationality.setAttribute('required', 'true');

    filipinoEthnicitySection.classList.add('hidden');
    // Clear any Filipino checkboxes if user switches away
    const checkboxes = filipinoEthnicitySection.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => (cb.checked = false));

    nonFilipinoEthnicity.classList.remove('hidden');
  } else {
    // No selection
    otherNationality.classList.add('hidden');
    otherNationality.removeAttribute('required');
    otherNationality.value = '';
    filipinoEthnicitySection.classList.add('hidden');
    nonFilipinoEthnicity.classList.add('hidden');
  }
}

// Attach event listeners
yearLevelSelect.addEventListener('change', () => handleOthers(yearLevelSelect, yearLevelOther));
sectionSelect.addEventListener('change', () => handleOthers(sectionSelect, sectionOther));
degreeSelect.addEventListener('change', () => handleOthers(degreeSelect, degreeOther));
nationalitySelect.addEventListener('change', handleNationalityChange);
