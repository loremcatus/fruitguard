import models from '../models/index.js';
import { areas, states } from '../../helpers/enums.js';
import { Sequelize } from 'sequelize';
import { validateFieldsDataType, getPermissionLevel, formatDate } from '../../helpers/validators.js';

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
  const fileHTML = 'list-houseRegistration';
  const title = 'Registro de Casas';
  try {
    const breadcrumbs = {
      CampaignId: req.params.CampaignId,
      FocusId: req.params.FocusId,
      BlockRegistrationId: req.params.BlockRegistrationId,
    };

    let blockRegistration;
    let searchOptions = {};
    const BlockRegistrationId = parseInt(req.params.BlockRegistrationId);
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
      console.error(error);
      return res.render('error.html', { error: 500 });
    }

    let i = 0;
    const formattedHouseRegistrations = []
    if (blockRegistration) {
      blockRegistration.Houses.filter(house => {
        const address = house.dataValues.address;
        const id = house.HouseRegistration.id;

        const { grid, area, state } = house.HouseRegistration;
        const isOpen = state == states.OPEN; 
        const params = { address, grid, area, isOpen, id };
        // Verificar si al menos una opción de búsqueda está presente
        if (Object.keys(searchOptions).length > 0) {
          // Verificar cada criterio de búsqueda si está presente y coincide con el valor correspondiente
          if (
            (!searchOptions.grid || grid == searchOptions.grid) &&
            (!searchOptions.area || area === searchOptions.area) &&
            (!searchOptions.state || state === searchOptions.state) &&
            (!searchOptions.id || id == searchOptions.id)
          ) {
            formattedHouseRegistrations[i] = params;
            i++;
            return true;
          };
        } else {
          formattedHouseRegistrations[i] = params;
          i++;
          // Si no hay opciones de búsqueda, devolver todas las casas sin filtrar
          return true;
        }
      });
      formattedHouseRegistrations.reverse();
    }
    const permissionLevel = getPermissionLevel(req.user.role);
    return res.render('index.html', { formattedHouseRegistrations, fileHTML, title, breadcrumbs, permissionLevel, areas, states });

  } catch (error) {
    console.error(error);
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
      data.isOpen = false;
      if (house.state == states.OPEN){
        data.isOpen = true;
      }
      const permissionLevel = getPermissionLevel(req.user.role);
      return res.render('index.html', { formattedHouseRegistrationns: data, fileHTML, areas, states, title, single, breadcrumbs, permissionLevel });
    } else {
      return res.render('error.html', { error: 404 });
    }
  } catch (error) {
    console.error(error);
    return res.render('error.html', { error: 500 });
  }
};

// Agregar un registro de bloque
export const addHouseRegistration = async (req, res) => {
  try {
    // Valida que vengan datos en el cuerpo
    if (Object.keys(req.body).length === 0) {
      return res.sendStatus(400);
    }

    const { address } = req.body;
    const { grid } = req.body;
    const { state } = req.body;
    const isOpen = state == states.OPEN; 
    const { area } = req.body;
    const { comment } = req.body;

    // Comprobar errores de validación
    if (!address || !grid || !state || !area ) {
      return res.sendStatus(400);
    }

    const houseRegistrationInfo = {
      grid,
      area,
      state,
      ...(comment && { comment }),
    };

    const blockRegistration = await BlockRegistration.findByPk(req.params.BlockRegistrationId, {
      attributes: ['id', 'BlockId']
    });
    const BlockId = blockRegistration.dataValues.BlockId;

    // Busca o crea una casa utilizando la dirección y el bloque
    const [house] = await House.findOrCreate({
      attributes: ['id'],
      where: { BlockId, address },
    });

    // Verifica si el registro de bloque ya tiene la casa asociada
    if (await blockRegistration.hasHouse(house)) { return res.sendStatus(409); };

    const houseRegistration = await blockRegistration.addHouse(house, { through: houseRegistrationInfo });

    const formatedHouseRegistrations = {
      id: houseRegistration[0].dataValues.id,
      address,
      grid,
      area,
      isOpen,
    }
    return res.status(201).json(formatedHouseRegistrations);

  } catch (error) {
    console.error('Error al insertar una casa', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
};

// Editar casa

export const updateHouseRegistration = async (req, res) => {
  try {
    // Validar que vengan datos en el cuerpo 
    const { houseInfo } = req.body;
    const { houseRegistrationInfo } = req.body;
    if (Object.keys(houseInfo).length == 0 && Object.keys(houseRegistrationInfo).length == 0) {
      return res.sendStatus(400);
    }

    const { HouseRegistrationId } = req.params;
    const houseRegistration = await HouseRegistration.findByPk(HouseRegistrationId, {
      attributes: ['id', 'HouseId']
    });
    const oldHouseId = houseRegistration.dataValues.HouseId;

    if (Object.keys(houseInfo).length > 0) {
      const validatedHouseFields = await validateFieldsDataType(houseInfo, House);
      if (validatedHouseFields.errors) {
        return res.sendStatus(400);
      }

      // Verificar si la casa no ha sido registrada previamente en el registro de bloque
      const registeredHouse = await BlockRegistration.findOne({
        attributes: ['id'],
        where: { id: req.params.BlockRegistrationId },
        include: {
          model: House,
          where: houseInfo
        }
      });
      if (registeredHouse) {
        return res.sendStatus(409);
      };

      // Verificar si la casa antigua tiene algún otro registro de casa
      const blocksRegistrationWithHouse = await BlockRegistration.findAll({
        attributes: ['id'],
        include: {
          model: House,
          where: { id: oldHouseId }
        }
      });
      // Verificar si ya existe una casa con la dirección para actualizar, o si no crearla
      const [houseWithNewAddress] = await House.findOrCreate({ attributes: ['id'], where: houseInfo });
      const newHouseId = houseWithNewAddress.dataValues.id;

      // Actualizar el HouseId del registro de la casa para vincularlo con la nueva casa
      await houseRegistration.update({ HouseId: newHouseId });

      // Borra la casa antigua en caso de que no este registrada a ningún otro registro de bloque
      if (blocksRegistrationWithHouse.length == 1) {
        await House.destroy({
          where: {
            id: oldHouseId
          }
        });
      }
    }

    if (Object.keys(houseRegistrationInfo).length > 0) {
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