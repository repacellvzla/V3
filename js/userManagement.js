import { safeJSONParse, showToast, showConfirmationModal } from './utils.js';

export function renderizarUsuarios(usuarioLogeado) {
    const tablaUsuariosBody = document.querySelector('#tabla-usuarios tbody');
    if (!tablaUsuariosBody) return;
    
    let usuarios = safeJSONParse('usuarios', []);
    let finalHTML = '';

    // --- Fila 1: Formulario para Añadir Usuario ---
    finalHTML += `
        <tr class="add-user-form-row">
            <td><input type="text" id="new-username-input" placeholder="Nuevo usuario" required></td>
            <td><input type="password" id="new-password-input" placeholder="Contraseña" required></td>
            <td>
                <select id="new-user-role-select">
                    <option value="ventas">Ventas</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="administrador">Administrador</option>
                </select>
            </td>
            <td class="actions-cell">
                <button id="add-user-btn" class="button button-primary">Añadir Usuario</button>
            </td>
        </tr>
    `;

    // --- Filas Siguientes: Usuarios Existentes ---
    usuarios.forEach(user => {
        const esAdmin = user.username === 'admin';
        const esUsuarioActual = user.id === usuarioLogeado.id;
        const disableActions = esAdmin || usuarioLogeado.rol !== 'administrador';

        finalHTML += `<tr data-user-id="${user.id}">`;
        
        finalHTML += `<td>${user.username}</td>`;
        
        // Celda de Contraseña
        finalHTML += `<td class="actions-cell">`;
        if (!disableActions) {
             finalHTML += `<button class="button button-secondary change-password-btn">Cambiar</button>`;
        } else {
             finalHTML += '••••••••';
        }
        finalHTML += `</td>`;

        // Celda de Rol
        finalHTML += '<td>';
        if(disableActions) {
            finalHTML += user.rol;
        } else {
            const rolesDisponibles = ['administrador', 'supervisor', 'ventas'];
            let options = rolesDisponibles.map(rol => `<option value="${rol}" ${user.rol === rol ? 'selected' : ''}>${rol}</option>`).join('');
            finalHTML += `<select class="user-role-select">${options}</select>`;
        }
        finalHTML += '</td>';

        // Celda de Acciones
        finalHTML += `<td class="actions-cell">`;
        if (!disableActions) {
             finalHTML += `<button class="button button-primary save-user-btn">Guardar</button>`;
        }
        if (!esUsuarioActual && !disableActions) { 
            finalHTML += `<button class="button button-danger remove-user-btn">Eliminar</button>`;
        }
        // -- CAMBIO: Añade un espacio vacío si no hay botones para mantener la alineación --
        if (esAdmin) {
            finalHTML += `&nbsp;`;
        }
        finalHTML += '</td>';

        finalHTML += '</tr>';
    });

    tablaUsuariosBody.innerHTML = finalHTML;
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