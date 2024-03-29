import { getPermissionLevel } from '../../helpers/validators.js';
import models from '../models/index.js';
const { UserRegistration, User, Team, Car, Campaign, Focus, Block, BlockRegistration, Sequelize } = models;

const clearTeams = async () => {
  // Obtener el día actual
  const today = new Date().toISOString().slice(0, 10);
  const team = await Team.findOne({
    attributes: ['createdAt']
  });

  if (!team) return;

  // Extraer el día de creación del equipo
  const teamCreatedDay = team.dataValues.createdAt.toISOString().slice(0, 10);

  if (today !== teamCreatedDay) {
    await UserRegistration.update({ TeamId: null }, {
      where: {
        TeamId: { [Sequelize.Op.not]: null }
      }
    });
    await Car.update({ TeamId: null }, {
      where: {
        TeamId: { [Sequelize.Op.not]: null }
      }
    });
    await Team.destroy({ truncate: true });
  }
}

// Obtener todas las campañas
export const getTeams = async (req, res) => {
  const fileHTML = 'list-teams';
  const title = 'Equipos';
  const formattedTeams = [];

  try {
    clearTeams();

    const supervisorId = req.user.id;

    const supervisorRegistration = await UserRegistration.findOne({
      attributes: ['id', 'CampaignId'],
      where: { UserId: supervisorId }
    });

    const CampaignId = supervisorRegistration.dataValues.CampaignId;

    const usersRegistration = await UserRegistration.findAll({
      attributes: ['id', 'UserId'],
      include: {
        model: Team
      },
      where: {
        CampaignId,
        TeamId: { [Sequelize.Op.not]: null }
      }
    });

    // No existen usuarios con equipos asignados
    if (usersRegistration.length == 0) return res.render('index.html', { formattedTeams, fileHTML, title });

    const userIds = usersRegistration.map(registration => registration.dataValues.UserId);
    const teamIds = [...new Set(usersRegistration.map(registration => registration.Team.dataValues.id))];

    const cars = {};
    const tasks = [];

    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      const team = await Team.findByPk(teamId);

      const numberOfBlocks = team.dataValues.tasks.split(',').length;

      const car = await team.getCar({
        attributes: ['patent', 'capacity']
      });

      const { patent, capacity } = car.dataValues;

      cars[teamId] = { patent, capacity };
      tasks.push({ team: teamId, numberOfBlocks });
    }

    const users = await User.findAll({
      attributes: ['id', 'name', 'hasLicense'],
      where: {
        id: { [Sequelize.Op.in]: userIds },
      }
    });

    for (let i = 0; i < users.length; i++) {
      const { id, name, hasLicense } = users[i].dataValues;
      const foundUser = usersRegistration.find(registration => registration.dataValues.UserId === id);

      if (foundUser) {
        const team = foundUser.Team.dataValues.id;
        const existingTeam = formattedTeams.find(item => item.team === team);

        if (existingTeam) {
          existingTeam.users.push({ id, name, hasLicense });
        } else {
          formattedTeams.push({ team, users: [{ id, name, hasLicense }], car: {}, tasks: 0 });
        }
      }
    }

    for (let i = 0; i < tasks.length; i++) {
      const { team, numberOfBlocks } = tasks[i];
      const existingTeam = formattedTeams.find(item => item.team === team);

      if (existingTeam) {
        existingTeam.tasks += numberOfBlocks;
      }
    }

    // Asignar los valores de cars a la propiedad car de cada equipo en formattedTeams
    formattedTeams.forEach(team => {
      const teamId = team.team;
      if (cars.hasOwnProperty(teamId)) {
        team.car = cars[teamId];
      }
    });

    return res.render('index.html', { formattedTeams, fileHTML, title });
  } catch (error) {
    console.error('Error al obtener equipos: ', error);
    return res.sendStatus(500);
  }
};

export const getTeam = async (req, res) => {
  const fileHTML = 'view-team';
  const title = 'Ver Equipo';
  const formattedTeam = [];
  const single = true;

  try {

    const team = await Team.findByPk(req.params.TeamId, {
      attributes: ['id', 'tasks']
    });

    if(!team) return res.sendStatus(404);

    const tasks = team.dataValues.tasks.split(',');
    const blocksRegistration = await BlockRegistration.findAll({
      attributes: ['id', 'FocuId', 'BlockId'],
      where: { id: { [Sequelize.Op.in]: tasks } }
    });

    const blocksId = [];
    const blocksRegistrationData = [];
    for(let i = 0; i < blocksRegistration.length; i++) {
      blocksId.push(blocksRegistration[i].dataValues.BlockId);
      blocksRegistrationData.push({
        id: blocksRegistration[i].dataValues.id
      });
      const focus = await Focus.findByPk(blocksRegistration[i].FocuId, {
        attributes: ['CampaignId']
      });
      const FocusId = blocksRegistration[i].dataValues.FocuId;
      const CampaignId = focus.dataValues.CampaignId
      const BlockRegistrationId = blocksRegistrationData[i].id;
      blocksRegistrationData[i].href = `/campaigns/${CampaignId}/focuses/${FocusId}/blocks/${BlockRegistrationId}`;
    }
    console.log(blocksRegistrationData);

    const blocksData = await Block.findAll({
      attributes: ['id', 'streets'],
      where: { id: { [Sequelize.Op.in]: blocksId } }
    });

    const blocks = [];
    for (const registration of blocksRegistrationData) {
      const { id, href } = registration;
    
      for (const data of blocksData) {
        const dataId = data.dataValues.id;
    
        if (id === dataId) {
          const streets = data.dataValues.streets;
          blocks.push({ id, href, streets });
          break;
        }
      }
    }
    console.log(blocks);

    const usersRegistration = await team.getUserRegistrations({
      attributes: ['UserId']
    });

    const usersId = []
    for(let i = 0; i < usersRegistration.length; i++) {
      usersId.push(usersRegistration[i].dataValues.UserId);
    }

    const usersData = await User.findAll({
      attributes: ['name', 'run', 'dvRun', 'hasLicense'],
      where: { id: { [Sequelize.Op.in]: usersId } }
    });

    const carData = await team.getCar({
      attributes: ['patent', 'capacity']
    })

    const car = {
      patent: carData.dataValues.patent,
      capacity: carData.dataValues.capacity,
    };

    const users = [];
    for(let i = 0; i < usersData.length; i++) {
      users.push({
        name: usersData[i].dataValues.name,
        rut: usersData[i].dataValues.run+'-'+usersData[i].dataValues.dvRun,
        hasLicense: usersData[i].dataValues.hasLicense,
      });
    }

    const formattedTeam = {
      id: team.dataValues.id,
      car,
      users,
      blocks,
    }

    const permissionLevel = getPermissionLevel(req.user.role);

    return res.render('index.html', { formattedTeam, fileHTML, title, single, permissionLevel });
  } catch (error) {
    console.error('Error al obtener equipo: ', error);
    return res.sendStatus(500);
  }
}

export const getTasks = async (req, res) => {
  try {
    const supervisorId = req.user.id;
    const supervisorRegistration = await UserRegistration.findOne({
      attributes: ['CampaignId'],
      where: { UserId: supervisorId }
    });

    const CampaignId = supervisorRegistration.dataValues.CampaignId;

    const usersRegistration = await UserRegistration.findAll({
      attributes: ['id', 'UserId'],
      include: {
        model: Team
      },
      where: {
        CampaignId,
        TeamId: { [Sequelize.Op.not]: null }
      }
    });

    const tasks = [];
    // Existen equipos con tareas asignadas
    if (usersRegistration.length > 0) {
      const teamIds = [...new Set(usersRegistration.map(registration => registration.Team.dataValues.id))];
      const teams = await Team.findAll({
        attributes: ['tasks'],
        where: {
          id: { [Sequelize.Op.in]: teamIds }
        }
      });

      for (let i = 0; i < teams.length; i++) {
        teams[i].dataValues.tasks.split(',').forEach((task) => {
          tasks.push(parseInt(task));
        });
      }
    }

    const focuses = await Focus.findAll({
      attributes: ['id', 'address'],
      where: {
        CampaignId
      }
    });

    // No hay focos creados en la campaña del supervisor
    if (!focuses.length) return res.sendStatus(404);

    const focusesId = [];
    const focusesAddress = [];
    for (let i = 0; i < focuses.length; i++) {
      focusesId.push(focuses[i].dataValues.id);
      focusesAddress.push(focuses[i].dataValues.address);
    };

    const blockRegistrations = await BlockRegistration.findAll({
      attributes: ['id', 'FocuId', 'BlockId'],
      where: {
        FocuId: { [Sequelize.Op.in]: focusesId },
        id: { [Sequelize.Op.notIn]: tasks },
      }
    });

    // No hay manzanas por muestrear o registradas en el foco
    if (!blockRegistrations.length) return res.sendStatus(404);

    const formattedTasks = [];
    for (let i = 0; i < blockRegistrations.length; i++) {
      formattedTasks.push({
        focus: blockRegistrations[i].dataValues.FocuId,
        block: blockRegistrations[i].dataValues.BlockId,
        blockRegistration: blockRegistrations[i].dataValues.id
      });
    };

    for (let i = 0; i < formattedTasks.length; i++) {
      const block = await Block.findOne({
        attributes: ['streets'],
        where: {
          id: formattedTasks[i].block
        }
      });
      formattedTasks[i].streets = block.dataValues.streets;
    };

    const formattedFocuses = [];
    for (let i = 0; i < focusesId.length; i++) {
      formattedFocuses.push({ focus: focusesId[i], address: focusesAddress[i] });
    };

    let tasksToDo = [];
    if (formattedFocuses) {
      tasksToDo = formattedFocuses.map((focus) => {
        const tasks = formattedTasks.filter((task) => task.focus === focus.focus);
        return {
          focus: focus.focus,
          address: focus.address,
          tasks: tasks.map(({ blockRegistration, streets }) => ({ blockRegistration, streets }))
        };
      }).filter(({ tasks }) => tasks.length > 0);
    }
    console.log(tasksToDo);
    return res.status(200).json(tasksToDo);
  } catch (error) {
    console.error('Error al obtener tareas: ', error);
    return res.sendStatus(500);
  }
};

// Listar autos disponibles
export const getCars = async (req, res) => {
  try {
    const cars = await Car.findAll({
      where: {
        available: true,
        TeamId: null
      }
    });

    if (!cars.length > 0) return res.sendStatus(404);

    const formattedCars = [];
    for (let i = 0; i < cars.length; i++) {
      const { id, patent, capacity } = cars[i].dataValues;
      formattedCars.push({ id, patent, capacity });
    };

    return res.status(200).json(formattedCars);
  } catch (error) {
    console.error('Error al obtener autos: ', error);
    return res.sendStatus(500);
  }
};

// Listar conductores disponibles
export const getDrivers = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const supervisorRegistration = await UserRegistration.findOne({
      attributes: ['id', 'CampaignId'],
      where: { UserId: supervisorId }
    });

    const CampaignId = supervisorRegistration.dataValues.CampaignId;

    const campaign = await Campaign.findByPk(CampaignId, { attributes: ['id'] });

    const drivers = await campaign.getUsers({
      where: {
        hasLicense: true
      }
    });

    // No hay conductores en la campaña
    if (!drivers.length > 0) return res.sendStatus(404);

    const formattedDrivers = [];
    for (let i = 0; i < drivers.length; i++) {
      if (!drivers[i].UserRegistration.dataValues.TeamId) {
        const { name } = drivers[i].dataValues;
        const userId = drivers[i].dataValues.id;
        formattedDrivers.push({ userId, name });
      }
    };
    // No hay conductores disponibles en la campaña
    if (!formattedDrivers.length > 0) return res.sendStatus(404);

    return res.status(200).json(formattedDrivers);
  } catch (error) {
    console.error('Error al obtener conductores: ', error);
    return res.sendStatus(500);
  }
};

export const getPassengers = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const supervisorRegistration = await UserRegistration.findOne({
      attributes: ['id', 'CampaignId'],
      where: { UserId: supervisorId }
    });

    const CampaignId = supervisorRegistration.dataValues.CampaignId;

    const campaign = await Campaign.findByPk(CampaignId, { attributes: ['id'] });

    const selectedUserIds = req.body;

    const passengers = await campaign.getUsers({
      where: {
        id: { [Sequelize.Op.notIn]: selectedUserIds },
      }
    });

    // No hay pasajeros disponibles
    if (!passengers.length > 0) return res.sendStatus(404);

    const formattedPassengers = [];
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].UserRegistration.dataValues.TeamId) {
        const { name } = passengers[i].dataValues;
        const userId = passengers[i].dataValues.id;
        const hasLicense = passengers[i].dataValues.hasLicense;
        formattedPassengers.push({ userId, name, hasLicense });
      }
    };

    // No hay disponibles disponibles en la campaña
    if (!formattedPassengers.length > 0) return res.sendStatus(404);

    return res.status(200).json(formattedPassengers);
  } catch (error) {
    console.error('Error al obtener pasajeros: ', error);
    return res.sendStatus(500);
  }
}

export const addTeam = async (req, res) => {
  try {
    const { tasks, carId, usersId } = req.body;

    const team = await Team.create({tasks});
    const car = await Car.findByPk(carId, { attributes: ['id'] });
    car.setTeam(team);
    const usersRegistration = await UserRegistration.findAll({
      attributes: ['id'],
      where: { UserId: { [Sequelize.Op.in]: usersId }}
    });
    await team.setUserRegistrations(usersRegistration);

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error al crear equipo: ', error);
    return res.sendStatus(500);
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const { TeamId } = req.params;

    await UserRegistration.update({ TeamId: null }, {
      where: { TeamId }
    });
    await Car.update({ TeamId: null }, { 
      where: { TeamId }
    });
    await Team.destroy({ where: { id: TeamId } });

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error al eliminar equipo: ', error);
    return res.sendStatus(500);
  }
};
