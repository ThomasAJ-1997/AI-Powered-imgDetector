// Tags being displayed per page
const tagsPerPage = 20;

// Event for uploading
document
  .getElementById("uploadButtonID")
  .addEventListener("click", async () => {
    // Handling the files
    const fileInput = document.getElementById("imageInputID");
    const file = fileInput.files[0];
    const imagePreview = document.getElementById("imagePreviewID");
    const uploadModal = document.getElementById("uploadModalID");
    const uploadProgress = document.getElementById("uploadProgressID");

    // No file image has been selected
    if (!file) return showToast("Please select an image file.");

    // Preview the image
    const reader = new FileReader();
    reader.onload = (e) => (imagePreview.src = e.target.result);
    reader.readAsDataURL(file);

    // Imagga API Code
    const apiKey = "acc_bce9a07966884cb";
    const apiSecret = "7a5e0f654356a020f31ca4b9c729e830";
    const authHeader = "Basic " + btoa(`${apiKey}:${apiSecret}`);

    // API Data for uploaded images
    const formData = new FormData();
    formData.append("image", file);

    try {
      // Show the uploaded modal and loading bar when getting image data
      uploadModal.style.display = "block";
      uploadProgress.style.width = "0%";

      // When the image is sent to Imagga
      const uploadRespond = await fetch("https://api.imagga.com/v2/uploads", {
        method: "POST",
        headers: { Authorization: authHeader },
        body: formData,
      });

      if (!uploadRespond.ok) throw new Error("Image Upload Failed.");

      // Tracking the upload progress
      const contentLength = +uploadRespond.headers.get("Content-Length");
      const reader = uploadRespond.body.getReader();

      let receivedLength = 0;
      let chunks = [];

      // Read the response and the updated progress on the image
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        uploadProgress.style.width`${(receivedLength / contentLength) * 100}%`;
      }

      // The decoded and parsed upload response
      const responseArray = new Uint8Array(receivedLength);

      let position = 0;
      for (const chunk of chunks) {
        responseArray.set(chunk, position);
        position += chunk.length;
      }

      const text = new TextDecoder("utf-8").decode(responseArray);
      const {
        result: { upload_id },
      } = JSON.parse(text);

      // fetch colors and tag data from analysis and Imagga API
      const { colorResult, tagsResult } = await Promise.all([
        fetch(`https://api.imagga.com/v2/colors?image_upload_id=${upload_id}`, {
          headers: { Authorization: authHeader },
        }).then((res) => res.json()),

        fetch(`https://api.imagga.com/v2/tags?image_upload_id=${upload_id}`, {
          headers: { Authorization: authHeader },
        }).then((res) => res.json()),
      ]);

      // Display the results in the UI
      displayColors(colorResult.result.colors);
      displayTags(tagsResult.result.tags);
    } catch (error) {
      console.error("Error", error);
      showToast("An error has occured while uploading image.");
    } finally {
      // Hide the upload loading bar after upload has been complete
      uploadModal.style.display = "none";
    }
  });

// Function to display the colors analysis results.
const displayColors = (colors) => {
  const colorsContainer = document.querySelector(".AI-colors-container");
  colorsContainer.innerHTML = ``;

  // If no colors are found, return an error message to the UI
  if (
    ![
      colors.background_colors,
      colors.foreground_colors,
      colors.image_colors,
    ].some((arr) => arr.length)
  ) {
    colorsContainer.innerHTML = `<p class="error">Nothing to show..</p>`;
    return;
  }

  // Generate the HTML code section for the different color types found in the image
  const generateColorSection = (title, colorData) => {
    return `
    <h3>${title}</h3>
    <div class="results">
    ${colorData
      .map(
        ({ html_code, closest_palette_color, percent }) =>
          `
      <div class="result-item" data-color"${html_code}">
      <div>
      <div class="color-box" style="background-color: ${html_code}" title="Color code: ${html_code}"></div>
      <p>${html_code}<span> - ${closest_palette_color}</span></p>
      </div>

      <div class="progress-bar">
      <span>${percent.toFixed(2)}%</span>
      <div class="progress" style="width: ${percent}%></div>
      </div>
      </div>
`
      )
      .join("")}
      </div>
    `;
  };

  // Append and generate the color section with IMAGGA data to the container
  colorsContainer.innerHTML += generateColorSection(
    "Background Colors",
    colors.background_colors
  );
  colorsContainer.innerHTML += generateColorSection(
    "Foreground Colors",
    colors.foreground_colors
  );
  colorsContainer.innerHTML += generateColorSection(
    "Image Colors",
    colors.image_colors
  );

  // Add click functionality to the copy color code.
  document
    .querySelectorAll(".AI-colors-container .result-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const colorCode = item.getAttribute("data-color");
        navigator.clipboard
          .writeText(colorCode)
          .then(() => showToast(`Copied: ${colorCode}`))
          .catch(() => showToast("Failed to copy color code!"));
      });
    });
};

// function to display all the tags with pagination
let allTags = [];
let displayedTags = 0;

const displayTags = (tags) => {
  const tagsContainer = document.querySelector(".AI-tags-container");
  const resultList = tagsContainer.querySelector(".results");
  const error = tagsContainer.querySelector(".error");
  const seeMoreButton = document.getElementById("seeMoreButtonID");
  const exportTagsButton = document.getElementById('exportButtonID"');

  // Clear previous tags from container
  if (resultList) {
    resultList.innerHTML = "";
  } else {
    const resultListContainer = document.createElement("div");
    resultListContainer.className = "results";
    tagsContainer.insertBefore(resultListContainer, seeMoreButton);
  }

  // Store the tags data and display tags count
  allTags = tags;
  displayedTags = 0;

  // Function to show more tags as an option for the user, if available.
  const showMoreTags = () => {
    const tagsToShow = allTags.slice(
      displayedTags,
      displayedTags + tagsPerPage
    );
    displayTags += tagsToShow.length;

    const tagsHTML = tagsToShow
      .map(
        ({ tag: { en } }) => `

      <div class="result-item">
      <p>${en}</p>
      </div>
    
    `
      )
      .join("");

    if (resultList) {
      resultList.innerHTML += tagsHTML;
    }

    // Toggle the visablity of error messages and buttons based on the displayed tags.
    error.style.display = displayedTags > 0 ? "none" : "block";
    seeMoreButton.style.display =
      displayedTags < allTags.length ? "block" : "none";
    exportTagsButton.style.display = displayedTags > 0 ? "block" : "none";
  };

  showMoreTags(); // Load the tags

  // Event listener for the SeeMore display buttons and export tags feature buttons
  seeMoreButton.addEventListener("click", showMoreTags);
  exportTagsButton.addEventListener("click", exportTagsToFile);
};

// function to export tags to text file for the user.
const exportTagsToFile = () => {
  if (allTags.length === 0) {
    showToast("No tags available to export.");
    return;
  }

  // Convert tags to text and trigger tha download
  const tagsText = allTags.map(({ tag: { en } }) => en).join("\n");
  const blob = new Blob([tagsText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Tags.txt";
  a.click();
  URL.revokeObjectURL(url);
};

// Function to show the toast message for the user
const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show"); // Hide toast feature
    setTimeout(() => document.body.removeChild(toast), 500);
  }, 3000);
};
