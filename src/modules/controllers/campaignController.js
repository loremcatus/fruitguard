import { Sequelize } from 'sequelize';
import models from '../models/index.js';
import { validateRequestBody } from '../../helpers/validators.js';

const { Campaign } = models;

// Obtener todas las campañas
export const getCampaigns = async (req, res) => {
  const fileHTML = 'search-campaign';
  const title = 'Campañas';

  try {
    const { name, open = true, region, commune } = req.query; // Obtener los parámetros de búsqueda de la URL

    // Convertir el valor de openString a booleano
    const openBoolean = open === true;

    // Construir el objeto de búsqueda dinámicamente
    const searchOptions = {
      ...(name && { name: { [Sequelize.Op.substring]: name } }),
      open: openBoolean,
      ...(region && { region }),
      ...(commune && { commune })
    };

    // Obtener todas las campañas con las propiedades definidas
    const campaigns = await Campaign.findAll({
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'region', 'commune', 'open'],
      where: searchOptions
    });

    const formattedCampaigns = campaigns.map((campaign) => {
      const { id, name, region, commune, open } = campaign;
      return { id, name, region, commune, open };
    });

    const data = campaigns.length > 0 ? formattedCampaigns : 'No hay campañas registradas o que coincidan con tu búsqueda';

    return res.render('index.html', { formattedCampaigns: data, fileHTML, title });
  } catch (error) {
    return res.render('error.html', { error: 404 });
  }
};

// Agregar una campaña
export const addCampaign = async (req, res) => {
  try {
    // Valida que vengan datos en el cuerpo
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'El cuerpo de la solicitud está vacío.' });
    }

    // Filtrar y validar el cuerpo de la solicitud
    const filteredObject = await validateRequestBody(req.body, Campaign);
    // Comprobar errores de validación
    if (filteredObject.error) {
      return res.status(400).json(filteredObject);
    }

    // Crear una nueva campaña en la base de datos y devolverla como respuesta
    const campaign = await Campaign.create(filteredObject);
    return res.status(201).json(campaign.toJSON());
  } catch (error) {
    console.error('Error al insertar una campaña', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
};
