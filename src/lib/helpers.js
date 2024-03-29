import bcrypt from 'bcryptjs';
const helpers = {};

helpers.encryptPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
};

//compara la password con la password en la base dedatos
helpers.matchPassword = async (password, savedPassword) => {
    try{
        return await bcrypt.compare(password, savedPassword);
    } catch(e) {
        console.log(e);
    }
};

helpers.matchRole = (role, savedRole) => {
    try{
        return role == savedRole;
    } catch(e) {
        console.log(e)
    }
}

helpers.separarRut = (rutCompleto) => {
    const partes = rutCompleto.split('-');
    const run = partes[0];
    const dvRun = partes[1];
  
    return { run, dvRun };
}

helpers.generatePassword = () => {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let string = '';

    for (let i = 0; i < 15; i++) {
        const indice = Math.floor(Math.random() * characters.length);
        string += characters.charAt(indice);
    }

    return string;
}
  

export default helpers;