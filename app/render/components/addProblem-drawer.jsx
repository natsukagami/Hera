var { ipcRenderer } = window.require('electron');
import React from 'react';
import { List, ListItem } from 'material-ui/List';
import IconButton from 'material-ui/IconButton';
import Drawer from 'material-ui/Drawer';
import Subheader from 'material-ui/Subheader';
import {Tabs, Tab} from 'material-ui/Tabs';
import { red500 } from 'material-ui/styles/colors';
import IconDelete from 'material-ui/svg-icons/action/delete';
import TextField from 'material-ui/TextField';

var TestcaseListItem = React.createClass({
	render() {
		var InOut = (<span>
						<span>Input: <b>{this.props.input}</b></span>
						<span> / Output: <b>{this.props.output}</b></span>
					</span>);
		return (<ListItem
					leftIcon={<IconButton
						tooltip={"Xóa test này"}
					><IconDelete color={red500}/></IconButton>}
					primaryText={this.props.name}
					secondaryText={InOut}
					nestedItems={[
						<ListItem
							primaryText={
								<TextField floatingLabelText="Điểm (-1 giữ mặc định)" floatingLabelFixed={true} value={this.props.score}/>
							}
						/>,
						<ListItem
							primaryText={
								<TextField floatingLabelText="Giới hạn thời gian (-1 giữ mặc định)" floatingLabelFixed={true} value={this.props.timeLimit}/>
							}
						/>,
						<ListItem
							primaryText={
								<TextField floatingLabelText="Giới hạn bộ nhớ (-1 giữ mặc định)" floatingLabelFixed={true} value={this.props.memLimit}/>
							}
						/>
					]}
				/>);
	}
});

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
			state: 'testcases' // Only in testing, switch to 'general' in production
		};
	},
	handleTabChange(event, value) {
		this.setState(value);
	},
	handleChange(open) {
		this.setState({open: open});
	},
	render() {
		var inst = this;
		console.log(this.state.config.testcases);
		var testcases = this.state.testcases.map(function(testcase, idx) {
			return (<TestcaseListItem
						name={testcase[2]}
						input={testcase[0]}
						output={testcase[1]}
						timeLimit={inst.state.config.testcases[idx].timeLimit}
						memLimit={inst.state.config.testcases[idx].memoryLimit}
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
