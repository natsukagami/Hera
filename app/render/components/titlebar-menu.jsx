var { ipcRenderer } = window.require('electron');
import React from 'react';
import IconButton from 'material-ui/IconButton';
import IconMenu from 'material-ui/IconMenu';
import MenuItem from 'material-ui/MenuItem';
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert';
import IconContentAdd from 'material-ui/svg-icons/content/add';
import IconContentOpen from 'material-ui/svg-icons/action/open-in-new';
import IconContentSave from 'material-ui/svg-icons/action/get-app';
import IconContentExport from 'material-ui/svg-icons/action/list';


function handleMenuAction(action) {
	ipcRenderer.send('menu-' + action);
	return true;
}

var TitleBarMenu = React.createClass({
	render: function() {
		return (
			<IconMenu
				className='TitleBarMenu'
				iconButtonElement={
					<IconButton><MoreVertIcon /></IconButton>
				}
				targetOrigin={{horizontal: 'left', vertical: 'top'}}
				anchorOrigin={{horizontal: 'left', vertical: 'top'}}
			>
			<MenuItem
				onClick={handleMenuAction('new-contest')}
				primaryText='Tạo Kì thi Mới'
				leftIcon={<IconContentAdd/>}
			/>
			<MenuItem
				onClick={handleMenuAction('load-contest')}
				primaryText='Mở lại Kì thi Cũ'
				leftIcon={<IconContentOpen/>}
			/>
			<MenuItem
				onClick={handleMenuAction('save-contest')}
				primaryText='Lưu Kì thi Hiện tại'
				leftIcon={<IconContentSave/>}
			/>
			<MenuItem
				onClick={handleMenuAction('export-contest')}
				primaryText='Xuất kết quả ra file Excel'
				leftIcon={<IconContentExport/>}
			/>
			</IconMenu>
		);
	}
});

export default TitleBarMenu;
