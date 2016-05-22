var { ipcRenderer } = window.require('electron');
import React from 'react';
import { List, ListItem } from 'material-ui/List';
import Drawer from 'material-ui/Drawer';
import Subheader from 'material-ui/Subheader';
import {Tabs, Tab} from 'material-ui/Tabs';
import { 	GeneralTextField,
			GeneralContent,
			TestcaseTextField,
			GeneralSelectField,
			TestcaseListItem
		}
	from './problemDrawer-components.jsx';

var ConfigProblemDrawer = React.createClass({
	getInitialState() {
		var inst = this;
		ipcRenderer.on('config-problem-drawer', function(event, config) {
			inst.setState({
				config: config,
				open: true
			});
		});
		return {
			config: {testcases: []},
			open: false,
			state: 'general' // Only in testing, switch to 'general' in production
		};
	},
	handleTabChange(event, value) {
		this.setState(value);
	},
	handleChange(open) {
		this.setState({
			open: open
		});
		if (open === false) {
			this.setState({
				config: {testcases: []}
			});
			ipcRenderer.send('config-problem-save');
		}
	},
	render() {
		var inst = this;
		var general = null;
		if (this.state.config.name !== undefined) {
			general = <GeneralContent config={this.state.config}/>;
		}
		var testcases = this.state.config.testcases.map(function(testcase, idx) {
			return (<TestcaseListItem
						name={testcase.name}
						configMode={true}
						timeLimit={testcase.timeLimit}
						memoryLimit={testcase.memoryLimit}
						score={testcase.score}
					/>);
		});
		return (<Drawer
					docked={false}
					width={700}
					open={this.state.open}
					onRequestChange={this.handleChange}
				>
					<Subheader inset={true}>{<span>Cấu hình bài tập: {this.state.config.name}</span>}</Subheader>
					<Tabs value={this.state.value} onChange={this.handleTabChange}>
						<Tab label='Cấu hình chung' value='general'>
							{general}
						</Tab>
						<Tab label='Cấu hình các test' value='testcases'>
							<List>
								{testcases}
							</List>
						</Tab>
					</Tabs>
				</Drawer>);
	}
});

module.exports = ConfigProblemDrawer;
