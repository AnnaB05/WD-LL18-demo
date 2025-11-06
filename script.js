// --- DOM elements ---
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");

// Add a global to keep the currently displayed recipe JSON
let currentRecipe = null;

// Try to get or create a Remix button and a theme selector so the app works even if HTML is missing them
let remixBtn = document.getElementById("remix-btn");
if (!remixBtn) {
  remixBtn = document.createElement("button");
  remixBtn.id = "remix-btn";
  remixBtn.textContent = "Remix";
  // insert after the random button if possible
  if (randomBtn && randomBtn.parentNode) randomBtn.parentNode.insertBefore(remixBtn, randomBtn.nextSibling);
  else document.body.appendChild(remixBtn);
}

let remixThemeSelect = document.getElementById("remix-theme");
if (!remixThemeSelect) {
  remixThemeSelect = document.createElement("select");
  remixThemeSelect.id = "remix-theme";
  const themes = ["Chef's Surprise", "Spicy Twist", "Vegan Remix", "Weeknight Quick", "Comfort Food"];
  themes.forEach(t => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    remixThemeSelect.appendChild(o);
  });
  // insert before the remix button
  remixBtn.parentNode.insertBefore(remixThemeSelect, remixBtn);
}

// Ensure there's a place to show the remixed recipe
// prefer existing container used in index.html if present
let remixDisplay = document.getElementById("remix-output") || document.getElementById("remix-display");
if (!remixDisplay) {
  remixDisplay = document.createElement("div");
  remixDisplay.id = "remix-display";
  remixDisplay.style.marginTop = "1rem";
  remixDisplay.style.whiteSpace = "pre-wrap"; // preserve line breaks
  // place below the recipe display
  if (recipeDisplay && recipeDisplay.parentNode) recipeDisplay.parentNode.insertBefore(remixDisplay, recipeDisplay.nextSibling);
  else document.body.appendChild(remixDisplay);
}

// interval id for the loading animation (so we can clear it later)
let remixLoadingInterval = null;

// Saved recipes elements (prefer existing in index.html)
const savedContainer = document.getElementById('saved-recipes-container');
const savedList = document.getElementById('saved-recipes-list');

// Local storage helpers
function getSavedRecipes() {
  try {
    const s = localStorage.getItem('savedRecipes');
    return s ? JSON.parse(s) : [];
  } catch (e) {
    console.error('Failed to read savedRecipes from localStorage', e);
    return [];
  }
}

function setSavedRecipes(arr) {
  try {
    localStorage.setItem('savedRecipes', JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to write savedRecipes to localStorage', e);
  }
}

// Render the saved recipes list and show/hide the container
function renderSavedRecipes() {
  if (!savedList) return;
  const recipes = getSavedRecipes();
  savedList.innerHTML = "";
  if (!recipes || recipes.length === 0) {
    if (savedContainer) savedContainer.style.display = 'none';
    return;
  }
  if (savedContainer) savedContainer.style.display = '';

  recipes.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'saved-recipe-item';

    const span = document.createElement('span');
    span.textContent = name;
    span.tabIndex = 0;
    // (Optional) could load the recipe by name when clicked — Step 7
    span.addEventListener('click', () => {
        // load the saved recipe details when clicked
        loadSavedRecipeByName(name);
    });

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.type = 'button';
    del.textContent = 'Delete';
    del.addEventListener('click', () => deleteSavedRecipe(name));

    li.appendChild(span);
    li.appendChild(del);
    savedList.appendChild(li);
  });
}

function saveCurrentRecipe() {
  if (!currentRecipe || !currentRecipe.strMeal) return;
  const name = currentRecipe.strMeal;
  const recipes = getSavedRecipes();
  if (recipes.includes(name)) {
    // already saved — give a subtle UI hint by briefly showing the container
    if (savedContainer) {
      savedContainer.style.display = '';
      // flash background could be added; for now just return
    }
    return;
  }
  recipes.push(name);
  setSavedRecipes(recipes);
  renderSavedRecipes();
}

function deleteSavedRecipe(name) {
  const recipes = getSavedRecipes().filter(r => r !== name);
  setSavedRecipes(recipes);
  renderSavedRecipes();
}

// Fetch a recipe by name from TheMealDB and display it
async function loadSavedRecipeByName(name) {
  if (!name) return;
  recipeDisplay.innerHTML = '<p>Loading saved recipe...</p>';
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`);
    if (!res.ok) {
      recipeDisplay.innerHTML = '<p>Sorry, could not load that recipe right now.</p>';
      console.error('MealDB search error:', res.status);
      return;
    }
    const data = await res.json();
    if (!data || !data.meals || data.meals.length === 0) {
      recipeDisplay.innerHTML = `<p>Could not find details for "${name}".</p>`;
      return;
    }
    const recipe = data.meals[0];
    currentRecipe = recipe;
    renderRecipe(recipe);
  } catch (err) {
    recipeDisplay.innerHTML = '<p>Sorry, something went wrong while loading the saved recipe.</p>';
    console.error('Error loading saved recipe by name:', err);
  }
}

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// This function displays the recipe on the page
function renderRecipe(recipe) {
  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <div class="save-row">
      <button id="save-recipe-btn" class="save-inline-btn" type="button">Save Recipe</button>
    </div>
  `;

  // Wire the save button for the current rendered recipe
  const saveBtn = document.getElementById('save-recipe-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCurrentRecipe);
  }
}

// This function gets a random recipe from the API and shows it
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Loading...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php'); // Replace with the actual API URL
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response

    // Save the raw recipe JSON so the remix function can use it
    currentRecipe = recipe;

    renderRecipe(recipe); // Display the recipe

  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
  }
}

// Helper to safely show AI text (escape any raw HTML tags)
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// This function sends the current recipe JSON and the chosen theme to OpenAI
// and displays the returned Remix on the page.
async function remixCurrentRecipe(theme) {
  // Make sure we have a recipe to remix
  if (!currentRecipe) {
    remixDisplay.textContent = "No recipe loaded to remix. Try 'Random' first.";
    return;
  }

  // Friendly loading message with animated dots
  remixDisplay.textContent = "Chef is mixing up your remix... 🍲✨";
  // simple dot animation — update every 350ms
  let dots = 0;
  if (remixLoadingInterval) clearInterval(remixLoadingInterval);
  remixLoadingInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    remixDisplay.textContent = `Chef is mixing up your remix... 🍲✨${".".repeat(dots)}`;
  }, 350);

  try {
    // Build the prompt and messages for the Chat Completions API
    const systemMessage = {
      role: "system",
      content: "You are a creative chef assistant. Produce a short, fun, creative, and totally doable remix of the given recipe. Highlight any changed ingredients and changed steps. Keep it concise and user-friendly."
    };

    const userMessage = {
      role: "user",
      content: `Remix theme: ${theme}\n\nHere is the raw recipe JSON from TheMealDB:\n\n${JSON.stringify(currentRecipe, null, 2)}\n\nPlease return a short remixed recipe with headings like "Remixed Recipe", "Changed Ingredients", and "Changed Instructions". Emphasize any substitutions or steps that changed.`
    };

        // Call OpenAI Chat Completions API (gpt-4.1)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // OPENAI_API_KEY is defined in secrets.js (students store their key there)
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [systemMessage, userMessage],
        temperature: 0.8,
        max_tokens: 400
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // Clear loading animation
      if (remixLoadingInterval) { clearInterval(remixLoadingInterval); remixLoadingInterval = null; }
      console.error("OpenAI API error:", resp.status, errText);
      remixDisplay.textContent = "Oops — I couldn't get a remix right now. Please try again in a moment.";
      return;
    }

    const data = await resp.json();
    const aiText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "No response from AI.";

    // Clear loading animation then show the AI's remixed recipe, escaping HTML and preserving line breaks
    if (remixLoadingInterval) { clearInterval(remixLoadingInterval); remixLoadingInterval = null; }
    remixDisplay.innerHTML = `<pre style="white-space:pre-wrap;">${escapeHtml(aiText)}</pre>`;

  } catch (error) {
    // Clear loading animation and show a friendly error to the user
    if (remixLoadingInterval) { clearInterval(remixLoadingInterval); remixLoadingInterval = null; }
    remixDisplay.textContent = "Oops — Something went wrong while remixing. Please try again in a moment.";
    console.error("Remix error:", error);
  }
}

// Wire the Remix button to the remix function
remixBtn.addEventListener("click", () => {
  const theme = remixThemeSelect.value || "Chef's Surprise";
  remixCurrentRecipe(theme);
});


// --- Event listeners ---

// When the button is clicked, get and show a new random recipe
randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);


// When the page loads, show a random recipe right away
document.addEventListener("DOMContentLoaded", () => {
  // Load saved recipes from localStorage and render them
  renderSavedRecipes();
  // Then fetch and show a random recipe
  fetchAndDisplayRandomRecipe();
});
