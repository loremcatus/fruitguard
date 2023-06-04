import models from '../models/index.js';
import { areas, states } from '../../helpers/enums.js';
import { Sequelize } from 'sequelize';
import { validateRequestBody, validateFieldsDataType, formatDate } from '../../helpers/validators.js';

const { HouseRegistration, BlockRegistration, House } = models;

// Función para determinar si el dato recibido es una ID de tipo número
const isNumericId = (data) => {
  return !isNaN(parseFloat(data)) && isFinite(data);
};

// Función para determinar si el dato recibido es una dirección de tipo cadena
const isStringAddress = (data) => {
  return typeof data === 'string';
};

export const getHouseRegistrations = async (req, res) => {
  try {
    const breadcrumbs = {
      CampaignId: req.params.CampaignId,
      FocusId: req.params.FocusId,
      BlockRegistrationId: req.params.BlockRegistrationId,
    };

    const fileHTML = 'list-houseRegistration';
    const title = 'Registro de Casas';
    let blockRegistration;
    let searchOptions = {};
    const BlockRegistrationId = parseInt(req.params.BlockRegistrationId, 10);
    try {
      const { idOrAddress, grid, area, state } = req.query;

      let id = ""
      let address = "";
      if (isNumericId(idOrAddress)) {
        id = idOrAddress;
      } else if (isStringAddress(idOrAddress)) {
        address = { address: { [Sequelize.Op.substring]: idOrAddress } };
      }
      // Realizar la consulta utilizando la dirección
      blockRegistration = await BlockRegistration.findOne({
        order: [['id', 'DESC']],
        attributes: ['id'],
        include: {
          model: House,
          where: address,
        },
        where: { id: BlockRegistrationId },
      });

      searchOptions = {
        ...(id && { id }),
        ...(grid && { grid }),
        ...(area && { area }),
        ...(state && { state })
      }

    } catch (error) {
      console.log(error);
      return res.render('error.html', { error: 500 });
    }

    let i = 0;
    const formatedHouseRegistrations = []
    blockRegistration.Houses.filter(house => {
      const address = house.dataValues.address;
      const id = house.HouseRegistration.id;
      //console.log("id houseRegistration " + id);
      const { grid, area, state } = house.HouseRegistration;
      const params = { address, grid, area, state, id };
      // Verificar si al menos una opción de búsqueda está presente
      if (Object.keys(searchOptions).length > 0) {
        // Verificar cada criterio de búsqueda si está presente y coincide con el valor correspondiente
        if (
          (!searchOptions.grid || grid == searchOptions.grid) &&
          (!searchOptions.area || area === searchOptions.area) &&
          (!searchOptions.state || state === searchOptions.state) &&
          (!searchOptions.id || id == searchOptions.id)
        ) {
          formatedHouseRegistrations[i] = params;
          i++;
          return true;
        };
      } else {
        formatedHouseRegistrations[i] = params;
        i++;
        // Si no hay opciones de búsqueda, devolver todas las casas sin filtrar
        return true;
      }
    });
    return res.render('index.html', { formattedHouseRegistration: formatedHouseRegistrations, fileHTML, title, breadcrumbs, areas, states });

  } catch (error) {
    console.log(error);
    return res.render('error.html', { error: 404 });
  }
};




// Obtener una campaña en específico
export const getHouseRegistration = async (req, res) => {
  const fileHTML = 'view-HouseRegistration';
  const title = 'Ver Registro de Casa';
  const single = true;

  const breadcrumbs = {
    CampaignId: req.params.CampaignId,
    FocusId: req.params.FocusId,
    BlockRegistrationId: req.params.BlockRegistrationId,
  };

  try {
    // Obtener todas las campañas con las propiedades definidas
    const houseRegistration = await HouseRegistration.findByPk(req.params.HouseRegistrationId, {
      attributes: ['id', 'grid', 'comment', 'area', 'state', 'createdAt', 'updatedAt', 'HouseId']
    });

    const houseAddress = await House.findByPk(houseRegistration.dataValues.HouseId, {
      attributes: ['address']
    });

    const house = {
      id: houseRegistration.dataValues.id,
      grid: houseRegistration.dataValues.grid,
      comment: houseRegistration.dataValues.comment,
      area: houseRegistration.dataValues.area,
      state: houseRegistration.dataValues.state,
      createdAt: houseRegistration.dataValues.createdAt,
      updatedAt: houseRegistration.dataValues.updatedAt,
      address: houseAddress.dataValues.address
    };


    if (house) {
      const { createdAt, updatedAt, ...data } = house;
      data.createdAt = formatDate(createdAt);
      data.updatedAt = formatDate(updatedAt);
      return res.render('index.html', { formattedHouseRegistrationns: data, fileHTML, areas, states, title, single, breadcrumbs });
    } else {
      return res.render('error.html', { error: 404 });
    }
  } catch (error) {
    console.log(error);
    return res.render('error.html', { error: 500 });
  }
};

// Agregar una campaña
export const addHouseRegistration = async (req, res) => {
  try {
    // Valida que vengan datos en el cuerpo
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud está vacío.' });
    }

    //Rescatar address del object
    const addressHouse = req.body.address;

    const BlockRegistrationId = parseInt(req.params.BlockRegistrationId, 10);

    const blockRegistration = await BlockRegistration.findOne({
      attributes: ['id'],
      where: { id: BlockRegistrationId },
    });

    // Busca o crea una casa (house) utilizando la dirección
    const [house, created] = await House.findOrCreate({
      where: { address: addressHouse, BlockId: BlockRegistrationId },
    });
    //si la casa existia dame la id de esa casa para crear un house registration con esa id de casa

    // Añade el bloque al enfoque si fue creado Y Verifica si el enfoque ya tiene el bloque asociado
    if (created || !(await blockRegistration.hasHouse(house))) {

      const idHouseRegistration = house.id;
      const grid = req.body.grid;
      const state = req.body.state;
      const area = req.body.area;
      const comment = req.body.comment;


      if (grid && state && area) {
        const houseRegistration = await blockRegistration.addHouse(house, { through: { grid, comment, area, state } });

        let formatedHouseRegistrations = { idHouseRegistration, grid, comment, area, state, BlockRegistrationId, addressHouse }
        // crear formattedHouseRegistration para mandarle los datos que quiero mostrar en el front 
        //luego en front houseregistration.js escribir las variables
        return res.status(201).json(formatedHouseRegistrations);
      } else {
        return res.status(400).json({ error: 'Faltan datos del formulario' });
      }

    } else {
      console.log('La casa ya existe en el blockregistration');
      // Filtrar y validar el cuerpo de la solicitud
      const validatedObject = await validateRequestBody(req.body, HouseRegistration);

      // Comprobar errores de validación
      if (validatedObject.error) {
        console.log(validatedObject.error);
        return res.status(400).json(validatedObject);
      }

      // Crear una nueva campaña en la base de datos y devolverla como respuesta
      const houseRegistration = await HouseRegistration.create(validatedObject);
      return res.status(201).json(houseRegistration.toJSON());

    }

  } catch (error) {
    console.error('Error al insertar una casa', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
};

// Editar casa

export const updateHouseRegistration = async (req, res) => {
  try {
    // Validar que vengan datos en el cuerpo 
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json('El cuerpo de la solicitud está vacío.');
    }

    const { HouseRegistrationId } = req.params;
    const houseRegistration = await HouseRegistration.findByPk(HouseRegistrationId, {
      attributes: ['id', 'HouseId']
    });
    const houseId = houseRegistration.dataValues.HouseId;

    const { houseInfo } = req.body; // es lo mismo que: const houseInfo = req.body.houseInfo;
    if (houseInfo) {
      const validatedHouseFields = await validateFieldsDataType(houseInfo, House);
      if (validatedHouseFields.errors) {
        return res.sendStatus(400);
      }
      await House.update(houseInfo, { where: { id: houseId } });
    }

    const { houseRegistrationInfo } = req.body;
    if (houseRegistrationInfo) {
      const validatedHouseRegistrationFields = await validateFieldsDataType(houseRegistrationInfo, HouseRegistration);
      if (validatedHouseRegistrationFields.errors) {
        return res.sendStatus(400);
      }
      await houseRegistration.update(houseRegistrationInfo);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error al actualizar la manzana', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
}