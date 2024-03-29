import models from '../models/index.js';
import { validateRequestBody, validateFieldsDataType, getPermissionLevel, formatDate } from '../../helpers/validators.js';
import { Sequelize } from 'sequelize';
import { states, treeStates } from '../../helpers/enums.js';

const { Campaign, Focus, Block, BlockRegistration, TreeSpeciesRegistration, TreeSpecies, Prospectus } = models;

export const getBlocks = async (req, res) => {
  const fileHTML = 'list-block';
  const title = 'Manzanas';

  try {

    const { streets } = req.query;
    const FocusId = parseInt(req.params.FocusId, 10);

    const breadcrumbs = {
      CampaignId: req.params.CampaignId,
      FocusId: req.params.FocusId,
    };

    const searchOptions = {
      ...(streets && { streets: { [Sequelize.Op.substring]: streets } }),
    }

    // Obtener todas las Manzanas que han sido registradas en el Foco
    const focus = await Focus.findOne({
      attributes: ['id'],
      include:
      {
        model: Block,
        where: searchOptions,
      },
      where: { id: FocusId },
    });

    const data = [];
    if (focus && "Blocks" in focus) {
      for (let i = 0; i < focus.Blocks.length; i++) {
        let streets = focus.Blocks[i].dataValues.streets.split("@");
        let blockRegistrationId = focus.Blocks[i].BlockRegistration.dataValues.id;
        data[i] = { streets, blockRegistrationId };
      }
    };
    data.reverse();
    const permissionLevel = getPermissionLevel(req.user.role);
    return res.render('index.html', { formattedBlocks: data, fileHTML, title, breadcrumbs, permissionLevel });
  } catch (error) {
    console.log(error);
    return res.render('error.html', { error: 404 });
  }
};

// Obtener una manzana en especifico 
export const getBlock = async (req, res) => {
  const fileHTML = 'view-block';
  const title = 'Ver Manzana';
  const single = true;

  const breadcrumbs = {
    CampaignId: req.params.CampaignId,
    FocusId: req.params.FocusId,
  };

  try {

    const blockRegistration = await BlockRegistration.findByPk(req.params.BlockRegistrationId, {
      attributes: ['id', 'BlockId', 'createdAt']
    })
    const blockStreets = await Block.findByPk(blockRegistration.dataValues.BlockId, {
      attributes: ['streets']
    });

    const block = {
      id: blockRegistration.dataValues.id,
      streets: blockStreets.dataValues.streets,
      createdAt: blockRegistration.dataValues.createdAt,
    }

    if (block) {
      const { createdAt, ...data } = block;// createdAt, updatedAt,
      data.createdAt = formatDate(createdAt);
      const permissionLevel = getPermissionLevel(req.user.role);
      return res.render('index.html', { formattedBlock: data, fileHTML, title, single, breadcrumbs, permissionLevel });
    } else {
      return res.render('error.html', { error: 404 });
    }
  } catch (error) {
    console.log(error);
    return res.render('error.html', { error: 500 });
  }
};

// Agregar una Manzanas
export const addBlock = async (req, res) => {
  try {
    // Valida que vengan datos en el cuerpo
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud está vacío.' });
    }

    // Obtiene los datos necesarios del cuerpo de la solicitud y del parámetro FocusId
    const { streets } = req.body;
    const FocusId = parseInt(req.params.FocusId, 10);

    // Crea un objeto con los datos obtenidos
    const object = {
      streets,
      FocusId: FocusId
    }

    // Filtrar y validar el cuerpo de la solicitud utilizando una función externa llamada "validateRequestBody"
    const validatedObject = await validateRequestBody(object, Block);

    // Comprobar errores de validación
    if (validatedObject.error) {
      return res.status(400).json(validatedObject);
    }

    // Busca un enfoque (focus) utilizando el FocusId proporcionado
    const focus = await Focus.findOne({
      attributes: ['id'],
      where: { id: FocusId },
    });

    // Busca o crea un bloque (block) utilizando el objeto validado
    const [block] = await Block.findOrCreate({
      where: validatedObject,
    });

    // Verifica si el foco ya tiene el bloque asociado
    if (await focus.hasBlock(block)) { return res.sendStatus(409); };

    // Añade el bloque al foco
    const blockRegistration = await focus.addBlock(block);

    const blockRegistrationFormatted = {
      id: blockRegistration[0].dataValues.id,
      FocusId
    };

    // Retorna el bloque como una respuesta JSON con estado 201 (creado)
    return res.status(201).json(blockRegistrationFormatted);
  } catch (error) {
    console.error('Error al insertar usuario', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
};


// Editar block 

export const updateBlock = async (req, res) => {
  try {
    // Validar que vengan datos en el cuerpo 
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json('El cuerpo de la solicitud está vacío.');
    }
    // Validar el cuerpo de la solicitud 
    const validatedFields = await validateFieldsDataType(req.body, Block);
    // Comprobar errores de validación
    if (validatedFields.errors) {
      return res.status(400).json(validatedFields.errors);
    }

    const { streets } = req.body;

    // Verificar si la casa no ha sido registrada previamente en el registro de bloque
    const registeredBlock = await Focus.findOne({
      attributes: ['id'],
      where: { id: req.params.FocusId },
      include: {
        model: Block,
        where: { streets }
      }
    });
    if (registeredBlock) {
      return res.sendStatus(409);
    };

    // Verificar si el bloque antiguo tiene algún otro registro de bloque
    const blockRegistration = await BlockRegistration.findByPk(req.params.BlockRegistrationId, {
      attributes: ['id', 'BlockId']
    });
    const oldBlockId = blockRegistration.dataValues.BlockId;

    const focusWithBlock = await Focus.findAll({
      attributes: ['id'],
      include: {
        model: Block,
        where: { id: oldBlockId }
      }
    });

    // Verificar si ya existe un bloque con las calles para actualizar, o si no crearlo
    const [blockWithNewStreets] = await Block.findOrCreate({ attributes: ['id'], where: { streets } });
    const newBlockId = blockWithNewStreets.dataValues.id;
    // Actualizar el BlockId del registro de bloque para vincularlo con el nuevo bloque
    await blockRegistration.update({ BlockId: newBlockId });

    // Borra el bloque antiguo en caso de que no este registrado a ningún otro bloque
    if (focusWithBlock.length == 1) {
      await Block.destroy({
        where: {
          id: oldBlockId
        }
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error al actualizar la manzana', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
}

export const generateBlockRegistrationReport = async (req, res) => {
  try {
    const { BlockRegistrationId } = req.params;
    const blockRegistration = await BlockRegistration.findByPk(BlockRegistrationId, {
      attributes: ['id', 'BlockId', 'FocuId']
    });
    const focus = await Focus.findByPk(blockRegistration.dataValues.FocuId, {
      attributes: ['address', 'CampaignId'], raw: true
    });
    const campaign = await Campaign.findByPk(focus.CampaignId, {
      attributes: ['name', 'region', 'commune'], raw: true
    });
    const block = await Block.findByPk(blockRegistration.dataValues.BlockId, {
      attributes: ['id', 'streets'], raw: true
    });
    
    const houses = await blockRegistration.getHouses();

    const formattedHouses = [];
    let numberOfPlacesOpen = 0;
    let numberOfPlacesClosed = 0;
    let numberOfInhabitedPlaces = 0;
    let numberOfProblemPlaces = 0;
    let numberOfPlacesWithFruitTrees = 0;
    let numberOfTreeSpeciesRegistrationWithSample = 0;
    let numberOfTreeSpeciesRegistrationWithoutSample = 0;
    for (const house of houses) {
      const houseRegistration = house.HouseRegistration.dataValues;
      const HouseRegistrationId = houseRegistration.id
      const area = houseRegistration.area;
      const address = house.dataValues.address
      let state = '';
      let hasFruit = false;
      const treeSpecies = [];
      if (houseRegistration.state === states.OPEN) {
        numberOfPlacesOpen++;
        const treeSpeciesRegistrations = await TreeSpeciesRegistration.findAll({
          attributes: ['id', 'tree_state', 'TreeSpecyId'],
          where: { HouseRegistrationId }, raw: true
        });
        for (let treeSpeciesRegistration of treeSpeciesRegistrations) {
          let treeState = treeSpeciesRegistration.tree_state;
          const TreeSpeciesRegistrationId = treeSpeciesRegistration.id;
          const { TreeSpecyId } = treeSpeciesRegistration;
          const species = (await TreeSpecies.findByPk(TreeSpecyId, {
            attributes: ['species'], raw: true
          })).species;
          if ([treeStates.RIPE, treeStates.UNRIPE].includes(treeState)) {
            hasFruit = true;
            const prospectus = await Prospectus.findOne({
              where: { TreeSpeciesRegistrationId }, raw: true
            });
            if (state != 'con muestras') state = prospectus ? 'con muestras' : 'sin muestras';
            if (prospectus) {
              numberOfTreeSpeciesRegistrationWithSample++;
              treeState = 'muestra'
            } else numberOfTreeSpeciesRegistrationWithoutSample++;
          }
          treeSpecies.push({ species, treeState });
        }
        if (!state) {
          state = 'sin frutales'
        };

      } else if (houseRegistration.state === states.CLOSE) {
        numberOfPlacesClosed++;
      } else if (houseRegistration.state === states.UNINHABITED) {
        numberOfInhabitedPlaces++;
      } else if (houseRegistration.state === states.REFUSE) {
        numberOfProblemPlaces++;
      }

      if (!state) state = houseRegistration.state;
      if (hasFruit) numberOfPlacesWithFruitTrees++;

      formattedHouses.push({
        area, address, state, treeSpecies
      });

    }

    const today = new Date();
    const format = 'D/MM/YYYY';

    const report = {
      todayDate: formatDate(today, format),
      campaignName: campaign.name,
      campaignRegion: campaign.region,
      campaignCommune: campaign.commune,
      focusAddress: focus.address,
      blockId: block.id,
      blockStreets: block.streets,
      numberOfPlacesVisited: formattedHouses.length,
      numberOfInhabitedPlaces,
      numberOfPlacesClosed,
      numberOfProblemPlaces,
      numberOfPlacesOpen,
      numberOfPlacesWithFruitTrees,
      numberOfTreeSpeciesRegistrationWithSample,
      numberOfTreeSpeciesRegistrationWithoutSample,
      formattedHouses,
    };
    return res.status(200).json(report);
  } catch (error) {
    console.error('Error al generar el reporte: ', error);
    return res.sendStatus(404);
  }
}
