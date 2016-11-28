var { ipcRenderer } = window.require('electron');
import React from 'react';
import AppBar from 'material-ui/AppBar';
import IconButton from 'material-ui/IconButton';
import NavigationClose from 'material-ui/svg-icons/navigation/close';
import TitleBarMenu from './titlebar-menu.jsx';

var NoDrag = React.createClass({
	render: function() {
		return (
			<div className='NoDrag'>{this.props.children}</div>
		);
	}
});

var CloseButton = React.createClass({
	handleClick: function() {
		ipcRenderer.send('close-main-window');
	},
	render: function() {
		return (<IconButton
			className='CloseButton'
			onClick={this.handleClick}
		><NavigationClose /></IconButton>);
	}
});

var TitleBar = React.createClass({
	render: function() {
		return (
			<div className="TitleBar" style={{width: '98%', position: 'fixed'}}>
				<AppBar
					title={this.props.title}
					iconElementLeft={<NoDrag><TitleBarMenu/></NoDrag>}
					iconElementRight={<NoDrag><CloseButton/></NoDrag>}
				/>
		</div>
		);
	}
});

export default TitleBar;
