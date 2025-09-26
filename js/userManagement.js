import { safeJSONParse, showToast, showConfirmationModal } from './utils.js';

export function renderizarUsuarios(usuarioLogeado) {
    const tablaUsuariosBody = document.querySelector('#tabla-usuarios tbody');
    if (!tablaUsuariosBody) return;
    
    let usuarios = safeJSONParse('usuarios', []);
    tablaUsuariosBody.innerHTML = '';

    usuarios.forEach(user => {
        const esAdmin = user.username === 'admin';
        const esUsuarioActual = user.id === usuarioLogeado.id;
        const disableActions = esAdmin || usuarioLogeado.rol !== 'administrador';

        const row = document.createElement('tr');
        row.dataset.userId = user.id;

        let userCell = `<td>${user.username}</td>`;
        
        let passwordCell = `<td class="actions-cell">`;
        if (!disableActions) {
             passwordCell += `<button class="button button-secondary change-password-btn">Cambiar</button>`;
        } else {
             passwordCell += '********';
        }
        passwordCell += '</td>';

        let roleCell = '<td>';
        if(disableActions) {
            roleCell += user.rol;
        } else {
            const rolesDisponibles = ['administrador', 'supervisor', 'ventas'];
            let options = rolesDisponibles.map(rol => `<option value="${rol}" ${user.rol === rol ? 'selected' : ''}>${rol}</option>`).join('');
            roleCell += `<select class="user-role-select">${options}</select>`;
        }
        roleCell += '</td>';

        let actionsCell = `<td class="actions-cell">`;
        if (!disableActions) {
             actionsCell += `<button class="button button-primary save-user-btn">Guardar</button>`;
        }
        if (!esUsuarioActual && !disableActions) { 
            actionsCell += `<button class="button button-danger remove-user-btn">Eliminar</button>`;
        }
        actionsCell += '</td>';

        row.innerHTML = userCell + passwordCell + roleCell + actionsCell;
        tablaUsuariosBody.appendChild(row);
    });
}

export function gestionarEventosUsuarios(usuarioLogeado) {
    const configContent = document.getElementById('modal-configuracion');
    if (!configContent) return;

    configContent.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.id === 'add-user-btn') {
            const newUsernameInput = document.getElementById('new-username-input');
            const newPasswordInput = document.getElementById('new-password-input');
            const newRoleSelect = document.getElementById('new-user-role-select');
            const username = newUsernameInput.value.trim();
            const password = newPasswordInput.value.trim();
            const rol = newRoleSelect.value;

            if (!username || !password) {
                showToast('El usuario y la clave son obligatorios.', 'error');
                return;
            }
            
            showConfirmationModal(`¿Estás seguro de agregar a "${username}"?`, () => {
                let usuarios = safeJSONParse('usuarios', []);
                if (usuarios.find(u => u.username.toLowerCase() === username.toLowerCase())) {
                    showToast('Ese nombre de usuario ya existe.', 'error');
                    return;
                }
                
                usuarios.push({ id: Date.now(), username, password, rol });
                localStorage.setItem('usuarios', JSON.stringify(usuarios));
                
                showToast('Usuario añadido exitosamente.', 'success');
                newUsernameInput.value = '';
                newPasswordInput.value = '';
                renderizarUsuarios(usuarioLogeado);
            });
        }

        const row = target.closest('tr');
        if (!row || !row.dataset.userId) return;
        const userId = Number(row.dataset.userId);

        if (target.classList.contains('remove-user-btn')) {
            showConfirmationModal('¿Estás seguro de eliminar este usuario?', () => {
                let usuarios = safeJSONParse('usuarios', []);
                usuarios = usuarios.filter(u => u.id !== userId);
                localStorage.setItem('usuarios', JSON.stringify(usuarios));
                showToast('Usuario eliminado.', 'success');
                renderizarUsuarios(usuarioLogeado);
            });
        }
        
        if (target.classList.contains('change-password-btn')) {
            const newPassword = prompt("Introduce la nueva contraseña para este usuario:");
            if (newPassword && newPassword.trim() !== '') {
                let usuarios = safeJSONParse('usuarios', []);
                const user = usuarios.find(u => u.id === userId);
                if (user) {
                    user.password = newPassword;
                    localStorage.setItem('usuarios', JSON.stringify(usuarios));
                    showToast('Contraseña actualizada.', 'success');
                }
            }
        }

        if (target.classList.contains('save-user-btn')) {
            const updatedRole = row.querySelector('.user-role-select').value;
            let usuarios = safeJSONParse('usuarios', []);
            const user = usuarios.find(u => u.id === userId);

            if (user) {
                user.rol = updatedRole;
                localStorage.setItem('usuarios', JSON.stringify(usuarios));
                showToast(`Rol de "${user.username}" actualizado.`, 'success');
                renderizarUsuarios(usuarioLogeado);
            }
        }
    });
}