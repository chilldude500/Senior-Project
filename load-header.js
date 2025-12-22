// load-header.js
async function loadHeader() {
    try {
        const response = await fetch('header.html');
        const headerHTML = await response.text();
        
        // Insert the header at the beginning of the body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
        
        // Wait a moment for the DOM to be ready, then initialize
        setTimeout(() => {
            initializeHeader();
        }, 100);
        
    } catch (error) {
        console.error('Error loading header:', error);
        // Fallback: create a basic header
        const fallbackHeader = `
            <div class="header" style="padding: 15px; background: white; border-bottom: 2px solid #3498db;">
                <a href="index.html" style="font-size: 24px; font-weight: bold; color: #2c3e50; text-decoration: none;">
                    🌌 Aurora Trips
                </a>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', fallbackHeader);
    }
}

// Function to initialize header functionality
function initializeHeader() {
    // Set active page based on current URL
    function setActivePage() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navButtons = document.getElementById('navButtons');
        
        if (!navButtons) return;
        
        // Define all navigation buttons with fixed widths
        const pages = [
            { name: 'Home', url: 'index.html', icon: 'fa-home' },
            { name: 'Currency', url: 'currency.html', icon: 'fa-money-bill-wave' },
            { name: 'Alerts', url: 'alerts.html', icon: 'fa-bell' },
            { name: 'Community', url: 'members.html', icon: 'fa-users' }
        ];
        
        // Clear existing buttons but preserve the container structure
        navButtons.innerHTML = '';
        
        // Create a flex container for consistent button sizing
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '10px';
        buttonsContainer.style.flexWrap = 'wrap';
        buttonsContainer.style.alignItems = 'center';
        
        // Create buttons for each page with fixed styling
        pages.forEach(page => {
            const button = document.createElement('button');
            button.className = 'nav-btn';
            button.innerHTML = `<i class="fas ${page.icon}"></i> ${page.name}`;
            
            // Fixed button styling
            button.style.padding = '10px 20px';
            button.style.fontSize = '15px';
            button.style.minWidth = '120px'; // Fixed minimum width
            button.style.textAlign = 'center';
            button.style.whiteSpace = 'nowrap';
            
            // Check if this is the current page
            if (currentPage === page.url || 
                (currentPage === '' && page.url === 'index.html')) {
                button.style.backgroundColor = '#e3f2fd';
                button.style.borderColor = '#3498db';
            } else {
                button.style.backgroundColor = 'white';
                button.style.borderColor = 'transparent';
            }
            
            button.onclick = () => window.location.href = page.url;
            buttonsContainer.appendChild(button);
        });
        
        navButtons.appendChild(buttonsContainer);
        
        // Add dynamic buttons to the right side
        addDynamicButtons();
    }
    
    // Add dynamic buttons (Support, Admin Panel)
    function addDynamicButtons() {
        const userId = localStorage.getItem('userId');
        const userIsAdmin = localStorage.getItem('userIsAdmin') === 'true';
        const navButtons = document.getElementById('navButtons');
        
        if (!navButtons) return;
        
        // Create container for dynamic buttons
        let dynamicButtonsContainer = document.getElementById('dynamicButtonsContainer');
        if (!dynamicButtonsContainer) {
            dynamicButtonsContainer = document.createElement('div');
            dynamicButtonsContainer.id = 'dynamicButtonsContainer';
            dynamicButtonsContainer.style.display = 'flex';
            dynamicButtonsContainer.style.gap = '10px';
            dynamicButtonsContainer.style.alignItems = 'center';
            dynamicButtonsContainer.style.marginLeft = 'auto'; // Push to right
            navButtons.appendChild(dynamicButtonsContainer);
        } else {
            dynamicButtonsContainer.innerHTML = '';
        }
        
        // Add Support button if logged in
        if (userId) {
            const supportButton = document.createElement('button');
            supportButton.id = 'ticketNavBtn';
            supportButton.className = 'nav-btn ticket-btn';
            supportButton.innerHTML = '<i class="fas fa-ticket-alt"></i> Support';
            supportButton.style.padding = '10px 20px';
            supportButton.style.fontSize = '15px';
            supportButton.style.minWidth = '120px';
            supportButton.style.textAlign = 'center';
            supportButton.style.whiteSpace = 'nowrap';
            supportButton.onclick = () => window.location.href = 'tickets.html';
            dynamicButtonsContainer.appendChild(supportButton);
        }
        
        // Add Admin Panel button if admin
        if (userId && userIsAdmin) {
            const adminButton = document.createElement('button');
            adminButton.id = 'adminPanelBtn';
            adminButton.className = 'nav-btn admin-btn';
            adminButton.innerHTML = '<i class="fas fa-crown"></i> Admin Panel';
            adminButton.style.padding = '10px 20px';
            adminButton.style.fontSize = '15px';
            adminButton.style.minWidth = '120px';
            adminButton.style.textAlign = 'center';
            adminButton.style.whiteSpace = 'nowrap';
            adminButton.onclick = () => window.location.href = 'admin-panel.html';
            dynamicButtonsContainer.appendChild(adminButton);
        }
    }
    
    // Check if user is logged in
    async function checkLoginStatus() {
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        const userEmail = localStorage.getItem('userEmail');
        const userIsAdmin = localStorage.getItem('userIsAdmin') === 'true';
        const userProfilePicture = localStorage.getItem('userProfilePicture');
        
        if (userId && userName && userEmail) {
            // Hide login prompt
            const loginPrompt = document.getElementById('loginPrompt');
            if (loginPrompt) {
                loginPrompt.style.display = 'none';
            }
            
            // Show user profile
            const userProfile = document.getElementById('userProfile');
            if (userProfile) {
                userProfile.style.display = 'block';
                
                // Update user info
                const userEmailElement = document.getElementById('userEmail');
                const userFullName = document.getElementById('userFullName');
                const userRole = document.getElementById('userRole');
                
                if (userEmailElement) userEmailElement.textContent = userEmail;
                if (userFullName) userFullName.textContent = userName;
                
                // Set user role
                if (userRole) {
                    if (userIsAdmin) {
                        userRole.textContent = 'Admin';
                        userRole.classList.add('admin');
                        const adminLink = document.getElementById('adminLink');
                        if (adminLink) adminLink.style.display = 'flex';
                    } else {
                        userRole.textContent = 'Member';
                        userRole.classList.remove('admin');
                    }
                }
                
                // Set avatar
                const userAvatar = document.getElementById('userAvatar');
                if (userAvatar) {
                    if (userProfilePicture) {
                        userAvatar.innerHTML = `<img src="${userProfilePicture}" alt="${userName}">`;
                    } else {
                        // Create initials from name
                        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                        userAvatar.textContent = initials;
                        
                        // Generate random gradient based on user initials
                        const colors = ['#3498db', '#9b59b6', '#2ecc71', '#e74c3c', '#f39c12', '#1abc9c'];
                        const color1 = colors[initials.charCodeAt(0) % colors.length];
                        const color2 = colors[initials.charCodeAt(1) % colors.length] || color1;
                        userAvatar.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;
                    }
                }
            }
            
            // Update dynamic buttons
            addDynamicButtons();
            
            // Check with server if user is banned (real-time check)
            try {
                fetch(`/api/user/status?userId=${userId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.loggedIn && data.user.isBanned) {
                            // User is banned according to server
                            alert('⚠️ Your account has been suspended. Please contact support.');
                            logout();
                        }
                    })
                    .catch(error => {
                        console.error('Error checking user status:', error);
                    });
            } catch (error) {
                console.error('Error checking user status:', error);
            }
        } else {
            // Show login prompt
            const loginPrompt = document.getElementById('loginPrompt');
            if (loginPrompt) {
                loginPrompt.style.display = 'flex';
            }
            
            // Hide user profile
            const userProfile = document.getElementById('userProfile');
            if (userProfile) {
                userProfile.style.display = 'none';
            }
            
            // Remove dynamic buttons
            const dynamicButtonsContainer = document.getElementById('dynamicButtonsContainer');
            if (dynamicButtonsContainer) {
                dynamicButtonsContainer.innerHTML = '';
            }
        }
    }
    
    // Toggle user dropdown
    const userToggle = document.getElementById('userToggle');
    if (userToggle) {
        userToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdown = document.getElementById('userDropdown');
            if (dropdown) {
                dropdown.classList.toggle('show');
            }
        });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    });
    
    // Prevent dropdown from closing when clicking inside it
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        userDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
    
    // Logout function
    function logout() {
        // Clear all user data from localStorage
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userIsAdmin');
        localStorage.removeItem('userProfilePicture');
        localStorage.removeItem('userIsBanned');
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
    
    // Attach logout function to window so it can be called from header.html
    window.logout = logout;
    
    // Initialize
    setActivePage();
    checkLoginStatus();
}

// Load the header when the page loads
document.addEventListener('DOMContentLoaded', loadHeader);