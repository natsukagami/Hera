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

var AddProblemDrawer = React.createClass({
	getInitialState() {
		var inst = this;
		ipcRenderer.on('add-problem-drawer', function(event, testcases, config) {
			inst.setState({
				testcases: testcases,
				config: config,
				open: true
			});
		});
		return {
			testcases: [],
			config: {},
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
				testcases: [],
				config: {}
			});
			ipcRenderer.send('add-problem-add');
		}
	},
	render() {
		var inst = this;
		var general = null;
		if (this.state.config.name !== undefined) {
			general = <GeneralContent config={this.state.config}/>;
		}
		var testcases = this.state.testcases.map(function(testcase, idx) {
			return (<TestcaseListItem
						name={testcase[2]}
						input={testcase[0]}
						output={testcase[1]}
						timeLimit={inst.state.config.testcases[idx].timeLimit}
						memoryLimit={inst.state.config.testcases[idx].memoryLimit}
						score={inst.state.config.testcases[idx].score}
					/>);
		});
		return (<Drawer
					docked={false}
					width={700}
					open={this.state.open}
					onRequestChange={this.handleChange}
				>
					<Subheader inset={true}>{<span>Thêm bài tập: {this.state.config.name}</span>}</Subheader>
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

module.exports = AddProblemDrawer;
