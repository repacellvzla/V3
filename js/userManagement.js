import { safeJSONParse, showToast, showConfirmationModal } from './utils.js';

let editingUserId = null; // Variable para rastrear qué usuario se está editando

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
                <button id="add-user-btn" class="button button-primary">Añadir</button>
            </td>
        </tr>
    `;

    // --- Filas Siguientes: Usuarios Existentes ---
    usuarios.forEach(user => {
        const esAdmin = user.username === 'admin';
        const esUsuarioActual = user.id === usuarioLogeado.id;
        const isEditing = user.id === editingUserId;

        finalHTML += `<tr data-user-id="${user.id}" class="${isEditing ? 'editing-row' : ''}">`;

        // Celda de Usuario
        if (isEditing && !esAdmin) {
            finalHTML += `<td><input type="text" class="edit-username-input" value="${user.username}"></td>`;
        } else {
            finalHTML += `<td>${user.username}</td>`;
        }
        
        // Celda de Contraseña
        finalHTML += `<td class="actions-cell">`;
        if (!esAdmin) {
            finalHTML += `<button class="button button-secondary change-password-btn">Cambiar</button>`;
        } else {
            finalHTML += '••••••••';
        }
        finalHTML += `</td>`;

        // Celda de Rol
        if (isEditing && !esAdmin) {
            const rolesDisponibles = ['administrador', 'supervisor', 'ventas'];
            let options = rolesDisponibles.map(rol => `<option value="${rol}" ${user.rol === rol ? 'selected' : ''}>${rol}</option>`).join('');
            finalHTML += `<td><select class="edit-role-select">${options}</select></td>`;
        } else {
            finalHTML += `<td>${user.rol}</td>`;
        }

        // Celda de Acciones
        finalHTML += `<td class="actions-cell">`;
        if (!esAdmin && usuarioLogeado.rol === 'administrador') {
            if (isEditing) {
                finalHTML += `<button class="button button-primary save-edit-btn">Guardar</button>`;
                finalHTML += `<button class="button button-secondary cancel-edit-btn">Cancelar</button>`;
            } else {
                finalHTML += `<button class="button button-secondary edit-user-btn">Editar</button>`;
                if (!esUsuarioActual) {
                    finalHTML += `<button class="button button-danger remove-user-btn">Eliminar</button>`;
                }
            }
        }
        finalHTML += `</td>`;
        finalHTML += `</tr>`;
    });

    tablaUsuariosBody.innerHTML = finalHTML;
}

export function gestionarEventosUsuarios(usuarioLogeado) {
    const configContent = document.getElementById('modal-configuracion');
    if (!configContent) return;

    configContent.addEventListener('click', (e) => {
        const target = e.target;
        
        // --- AÑADIR USUARIO ---
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

        const row = target.closest('tr[data-user-id]');
        if (!row) return;
        const userId = Number(row.dataset.userId);

        // --- ENTRAR EN MODO EDICIÓN ---
        if (target.classList.contains('edit-user-btn')) {
            editingUserId = userId;
            renderizarUsuarios(usuarioLogeado);
        }

        // --- CANCELAR EDICIÓN ---
        if (target.classList.contains('cancel-edit-btn')) {
            editingUserId = null;
            renderizarUsuarios(usuarioLogeado);
        }

        // --- GUARDAR CAMBIOS ---
        if (target.classList.contains('save-edit-btn')) {
            const updatedUsername = row.querySelector('.edit-username-input').value.trim();
            const updatedRole = row.querySelector('.edit-role-select').value;
            
            if (!updatedUsername) {
                showToast('El nombre de usuario no puede estar vacío.', 'error');
                return;
            }

            let usuarios = safeJSONParse('usuarios', []);
            const isUsernameDuplicate = usuarios.some(u => u.username.toLowerCase() === updatedUsername.toLowerCase() && u.id !== userId);

            if (isUsernameDuplicate) {
                showToast('Ese nombre de usuario ya está en uso.', 'error');
                return;
            }

            const user = usuarios.find(u => u.id === userId);
            if (user) {
                user.username = updatedUsername;
                user.rol = updatedRole;
                localStorage.setItem('usuarios', JSON.stringify(usuarios));
                showToast('Usuario actualizado.', 'success');
                editingUserId = null; // Salir de modo edición
                renderizarUsuarios(usuarioLogeado);
            }
        }

        // --- ELIMINAR Y CAMBIAR CLAVE ---
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
    });
}