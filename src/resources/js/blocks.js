import { showMessage } from "./helpers.js";

// CREATE
// Obtener referencias a los elementos del formulario 
const formAdd = document.getElementById('addPost');

// Evento de envío de formulario 
formAdd.addEventListener('submit', async (event) => {
  event.preventDefault(); // Evita el envío de formulario por defecto

  let inputs = document.getElementsByClassName("street-input");

  // Obtener los valores de los inputs
  const inputValues = [];
  for (let i = 0; i < inputs.length; i++) {
    let inputValue = inputs[i].value.trim();
    // Validar los campos de formulario 
    if (!inputValue) {
      showMessage('Por favor, no deje calles vacías', 'error');
      return;
    };
    inputValues.push(inputValue);
  }

  // Ordenar el array inputValues
  inputValues.sort();

  // Formar la variable streetsArray con los valores ordenados
  let streetsArray = "";
  for (let i = 0; i < inputValues.length; i++) {
    streetsArray += `<p class="card-left-side-bottom">${inputValues[i]}</p>`;
  }

  // Formar la variable streets con los valores ordenados
  let streets = inputValues.join('@');

  try {

    // Obtener los valores de los campos del formulario
    const object = {
      streets
    };

    // Obtener el host y el puerto del servidor actual
    const host = window.location.hostname; // localhost
    const port = window.location.port; // 8000
    const pathName = window.location.pathname;// campaigns/2/focuses/4/blocks/8

    // Construir la URL base 
    const baseUrl = `http://${host}:${port}`;

    // Componer la URL completa para la solicitud 
    const url = `${baseUrl}/api${pathName}`;

    // Enviar el objeto al servidor 
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(object),
      headers: {
        'content-Type': 'application/json'
      }
    });

    if (response.status === 201) {

      // Procesar la respuesta del servidor
      const data = await response.json();
      showMessage(`Manzana registrada correctamente`);// deberia ser otro msg

      // Obtener el conetenedor de las campañas
      const blocksContainer = document.querySelector('.cards');

      // Verificar si el blocksContainer contiene una etiqueta 'p' dentro
      //si existe un párrafo dentro de focusedContainer,limpiar el contenido
      if (blocksContainer.firstElementChild.tagName === 'P') {
        blocksContainer.innerHTML = '';
      };

      //Crear un nuevo elemento de campaña con los datos recibidos
      const newBlocksElement = document.createElement('a');
      newBlocksElement.href = `blocks/${data.id}`;
      newBlocksElement.insertAdjacentHTML('beforeend', `
              <div class="card-left-side">
                <p class="card-left-side-top">${data.id}</p>
                ${streetsArray}
              </div>
          `);

      // Agregar el nuevo elemento de campaña al contenedor existente
      blocksContainer.prepend(newBlocksElement);

    } else if (response.status === 409) {
      throw new Error('La manzana ya ha sido registrada en el foco');
    } else {
      throw new Error('Error al enviar el formulario');
    };
  } catch (error) {
    // Manejar el error 
    showMessage(error, 'error');
    console.log('Error al enviar el formulario:', error);
  };
});

// READ 

// Obtener referencia a los elementos del formulario
const formSearch = document.getElementById('searchPost');
const streetsSearchAdd = document.getElementById('streetsSearch');

// Evento de envío de formulario
formSearch.addEventListener('submit', async (event) => {
  event.preventDefault(); // Evitar el envio de formulario por defecto

  try {
    const streets = streetsSearchAdd.value;
    console.log(streets);

    // Crear el objeto con los valores del formulario
    const object = {
      ...(streets && { streets }),
    };

    //Serializar el objeto en formato de consulta URL
    const queryParams = new URLSearchParams(object).toString();

    // Redirigir a la pagina actual con los parametros de búsqueda en la URL
    window.location.search = queryParams;
  } catch (error) {
    // Manejar el error
    showMessage('Error al realizar la búsqueda', 'error');
    console.error('Error al realizar la búsqueda: ', error);
  };
});

// STREETS ADD/REMOVE

const addStreetButton = document.getElementById('add-street');
const streetContainer = document.getElementById('addPost');
const removeStreetDivs = document.querySelectorAll('.remove-street');

removeStreetDivs.forEach((removeStreetDiv) => {
  removeStreetDiv.addEventListener('click', () => {
    const streetDiv = removeStreetDiv.parentNode;
    streetDiv.remove();
    if (streetContainer.querySelectorAll('.street-can-be-remove').length < 5) {
      addStreetButton.style.display = 'block';
    }
  });
});

addStreetButton.addEventListener('click', () => {
  const streetDivs = streetContainer.querySelectorAll('.street-can-be-remove');
  const streetCount = streetDivs.length;

  if (streetCount < 5) {
    // Crear el elemento div con la clase "street-can-be-remove"
    const streetDiv = document.createElement('div');
    streetDiv.classList.add('street-can-be-remove');

    // Crear el elemento input con la clase "street-input"
    const streetInput = document.createElement('input');
    streetInput.classList.add('street-input');
    streetInput.type = 'text';
    streetInput.placeholder = 'Nombre de la calle';

    // Crear el elemento div con la clase "remove-street"
    const removeStreetDiv = document.createElement('div');
    removeStreetDiv.classList.add('remove-street');

    removeStreetDiv.addEventListener('click', () => {
      streetDiv.remove();
      if (streetContainer.querySelectorAll('.street-can-be-remove').length < 5) {
        addStreetButton.style.display = 'block';
      }
    });

    // Añadir los elementos al contenedor de calles
    streetDiv.appendChild(streetInput);
    streetDiv.appendChild(removeStreetDiv);
    streetContainer.insertBefore(streetDiv, addStreetButton);

    if (streetCount + 1 === 5) {
      addStreetButton.style.display = 'none';
    }
  } else {
    // Aquí puedes agregar el código que deseas ejecutar cuando se alcance el límite de calles (5)
    console.log('Se alcanzó el límite de calles');
  }
});
