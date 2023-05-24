import { Sequelize } from 'sequelize';
import models from '../models/index.js';
import { validateRequestBody, formatDate } from '../../helpers/validators.js';

const { Campaign } = models;

// Obtener todas las campañas
export const getCampaigns = async (req, res) => {
  const fileHTML = 'list-treeRegistration';
  const title = 'Listar Registro de Árboles';

  try {
    const { tree_state, TreeSpecyId } = req.query; // Obtener los parámetros de búsqueda de la URL

    // Construir el objeto de búsqueda dinámicamente
    const searchOptions = {
      ...(tree_state && { tree_state }),
      ...(TreeSpecyId && { TreeSpecyId })
    };

    // Obtener todas las campañas con las propiedades definidas
    const campaigns = await Campaign.findAll({
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'region', 'commune', 'open'],
      where: searchOptions
    });

    const data = campaigns.length > 0 ? campaigns : 'No hay campañas registradas o que coincidan con tu búsqueda';

    return res.render('index.html', { formattedCampaigns: data, fileHTML, title });
  } catch (error) {
    return res.render('error.html', { error: 500 });
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
    const validatedObject = await validateRequestBody(req.body, Campaign);
    // Comprobar errores de validación
    if (validatedObject.error) {
      return res.status(400).json(validatedObject);
    }

    // Crear una nueva campaña en la base de datos y devolverla como respuesta
    const campaign = await Campaign.create(validatedObject);
    return res.status(201).json(campaign.toJSON());
  } catch (error) {
    console.error('Error al insertar una campaña', error);
    return res.status(500).json({ error: 'Ocurrió un error en el servidor' });
  }
};
