import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { roles } from '../../helpers/enums.js';
import { getPermissionLevel } from '../../helpers/validators.js';
import helpers from '../../lib/helpers.js';
import models from '../models/index.js';
const { User, UserRegistration } = models;

export const getLogin = async (req, res) => {
  const fileHTML = 'login';
  const title = 'Iniciar Sesión';
  return res.render('not-logged.html', { fileHTML, title });
}

export const resetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) throw new Error('El correo no se recibió correctamente');

    const user = await User.findOne({
      attributes: ['id','email','name'],
      where: { email }
    });
    if(!user) return res.sendStatus(404);

    const newPassword = helpers.generatePassword();

    // Enviar credenciales a usuario
    sendResetPassword(user.name, user.email, newPassword);

    const password = await helpers.encryptPassword(newPassword);

    await user.update({password});

    return res.sendStatus(200);
  } catch (error) {
    console.error('Error al recuperar la contraseña: ', error);
    return res.sendStatus(500);
  }
}

export const getHome = async (req, res) => {
  const fileHTML = 'home';
  const title = 'Inicio';

  const permissionLevel = getPermissionLevel(req.user.role);
  const userId = req.user.id;

  let CampaignId = 0;
  if (permissionLevel == 2) {
    const userCampaign = await UserRegistration.findOne({
      attributes: ['CampaignId'],
      where: { UserId: userId },
      raw: true
    });
    if (userCampaign) {
      CampaignId = userCampaign.CampaignId;
    }
  }

  let TeamId = 0;
  if (permissionLevel == 1) {
    const userTeam = await UserRegistration.findOne({
      attributes: ['TeamId'],
      where: { UserId: userId },
      raw: true
    });
    if (userTeam) {
      TeamId = userTeam.TeamId;
    }
  }

  return res.render('index.html', { fileHTML, title, roles, permissionLevel, CampaignId, TeamId });
};

function sendResetPassword(name, mail, password){
  dotenv.config();

  const {
    NODEMAILER_EMAIL: user,
    NODEMAILER_API_KEY: pass,
  } = process.env;

  // Configuración del transporte de correo
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: { user, pass },
  });

  // Detalles del correo electrónico
  const mailOptions = {
    from: user,
    to: mail,
    subject: 'Recuperación de contraseña para Fruitguard - Acceso a la aplicación del SAG',
    html: `
    <p>Estimado/a ` + name + `,</p>
    <p>Recibimos tu solicitud de recuperación de contraseña para Fruitguard del Servicio Agrícola y Ganadero. Hemos generado una nueva contraseña para tu cuenta: </p>
    <p>Contraseña: ` + password + `</p>
    <p>Te recomendamos iniciar sesión lo antes posible utilizando estos datos y cambiar la contraseña temporal por una de tu elección.</p>
    <p>Si necesitas ayuda, no dudes en contactarnos.</p>
    <p>Saludos cordiales,</p>
    <p>Equipo de Fruit Guard</p>
    <img src="cid:imagen1">
  `,
    attachments: [
      {
        filename: 'Sag-footer.jpg',
        path: 'src/resources/images/Sag-footer.jpg',
        cid: 'imagen1',
      },
    ],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log('Correo electrónico enviado: ' + info.response);
    }
  });
}