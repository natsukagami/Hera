import React from 'react';
import {Table, TableBody, TableHeader, TableHeaderColumn, TableRow, TableRowColumn} from 'material-ui/Table';
import IconAscending from 'material-ui/svg-icons/communication/call-made';
import IconDecending from 'material-ui/svg-icons/communication/call-received';
import Popover from 'material-ui/Popover';
import Menu from 'material-ui/Menu';
import MenuItem from 'material-ui/MenuItem';
var { ipcRenderer } = window.require('electron');

var ScoreCellWithContextMenu = React.createClass({
	getInitialState() {
		return {
			open: false
		};
	},
	handleContextMenu(event) {
		event.preventDefault();
		this.setState({
			open: true,
			anchorEl: event.currentTarget
		});
	},
	handleRequestClose() {
		this.setState({
			open: false
		});
	},
	handleMenuChange(event, value) {
		ipcRenderer.send(value, {
			problem: this.props.problem,
			student: this.props.student
		});
		this.setState({
			open: false
		});
	},
	render() {
		return (<div>
					<div
						onContextMenu={this.handleContextMenu}
					>
					{this.props.children}
					</div>
					<Popover
						open={this.state.open}
						anchorEl={this.state.anchorEl}
						anchorOrigin={{'horizontal':'left', 'vertical':'bottom'}}
						targetOrigin={{'horizontal':'left', 'vertical':'top'}}
						onRequestClose={this.handleRequestClose}
					>
						<Menu onChange={this.handleMenuChange}>
							<MenuItem value='result-drawer' primaryText={'Xem kết quả'}/>
							<MenuItem value='rejudge' primaryText={'Chấm lại...'}/>
						</Menu>
					</Popover>
				</div>);
	}
});

var StudentCellWithContextMenu = React.createClass({
	getInitialState() {
		return {
			open: false
		};
	},
	handleContextMenu(event) {
		event.preventDefault();
		this.setState({
			open: true,
			anchorEl: event.currentTarget
		});
	},
	handleRequestClose() {
		this.setState({
			open: false
		});
	},
	handleMenuChange(event, value) {
		ipcRenderer.send(value, {
			student: this.props.student
		});
		this.setState({
			open: false
		});
	},
	render() {
		return (<div>
					<div
						onContextMenu={this.handleContextMenu}
					>
					{this.props.student}
					</div>
					<Popover
						open={this.state.open}
						anchorEl={this.state.anchorEl}
						anchorOrigin={{'horizontal':'left', 'vertical':'bottom'}}
						targetOrigin={{'horizontal':'left', 'vertical':'top'}}
						onRequestClose={this.handleRequestClose}
					>
						<Menu onChange={this.handleMenuChange}>
							<MenuItem value='delete-student' primaryText={'Xóa thí sinh'}/>
						</Menu>
					</Popover>
				</div>);
	}
});

var ProblemCellWithContextMenu = React.createClass({
	getInitialState() {
		return {
			open: false
		};
	},
	handleContextMenu(event) {
		event.preventDefault();
		this.setState({
			open: true,
			anchorEl: event.currentTarget
		});
	},
	handleRequestClose() {
		this.setState({
			open: false
		});
	},
	handleMenuChange(event, value) {
		ipcRenderer.send(value, {
			problem: this.props.problem
		});
		this.setState({
			open: false
		});
	},
	render() {
		return (<div>
					<div
						onContextMenu={this.handleContextMenu}
					>
					{this.props.children}
					</div>
					<Popover
						open={this.state.open}
						anchorEl={this.state.anchorEl}
						anchorOrigin={{'horizontal':'left', 'vertical':'bottom'}}
						targetOrigin={{'horizontal':'left', 'vertical':'top'}}
						onRequestClose={this.handleRequestClose}
					>
						<Menu onChange={this.handleMenuChange}>
							<MenuItem value='config-problem' primaryText={'Cấu hình bài tập'}/>
						</Menu>
					</Popover>
				</div>);
	}
});

var OverviewTable = React.createClass({
	getInitialState() {
		var inst = this;
		ipcRenderer.on('reload-table', function(event, data) {
			var state = {
				students: [],
				problems: [],
				currentOrder: {
					col: 'none',
					order: 1 // 1 = ascending, -1 = decending
				}
			};
			Object.keys(data.students).forEach(function(studentId) {
				state.students.push(data.students[studentId]);
			});
			Object.keys(data.problems).forEach(function(problemId) {
				state.problems.push(problemId);
			});
			inst.setState(state);
			inst.forceUpdate();
		});
		return {
			// Raw data, for now
			students: [],
			problems: [],
			currentOrder: {
				col: 'none',
				order: 1 // 1 = ascending, -1 = decending
			}
		};
	},
	handleHeaderClick(event) {
		if (event.target.getAttribute('data-colName') === undefined) return;
		var target = event.target;
		this.setState(function(state, props) {
			var newState = {};
			if (target.getAttribute('data-colName') === state.currentOrder.col) {
				newState.currentOrder = {
					col: state.currentOrder.col,
					order: state.currentOrder.order * -1
				};
			} else newState.currentOrder = {
				col: target.getAttribute('data-colName'),
				order: 1
			};
			state.students.sort(function(a, b) {
				var x, y;
				if (newState.currentOrder.col === '__name') {
					x = a.name, y = b.name;
				} else if (newState.currentOrder.col === '__total') {
					x = a.total, y = b.total;
				} else {
					var pName = newState.currentOrder.col;
					x = ((typeof a.problems[pName]) === 'object' ? a.problems[pName].score : -1);
					y = ((typeof b.problems[pName]) === 'object' ? b.problems[pName].score : -1);
				}
				var ans = (x < y ? -1 : (x === y ? 0 : 1)) * newState.currentOrder.order;
				return ans;
			});
			newState.students = state.students;
			return newState;
		});
	},
	renderHeader(name, colname) {
		var added = '';
		if (colname === this.state.currentOrder.col) {
			added = <span>
				{(this.state.currentOrder.order == 1 ? <IconAscending style={{width: 14, height: 14}}/> :
					<IconDecending style={{width: 14, height: 14}}/>)}
			</span>;
		}
		var ret = (<span>
					<span data-colName={colname} onClick={this.handleHeaderClick}>{name}</span>
					{added}
				</span>);
		if (name === colname) ret = (<ProblemCellWithContextMenu problem={name}>{ret}</ProblemCellWithContextMenu>);
		return (ret);
	},
	render() {
		var instance = this;
		var problemHeaders = this.state.problems.map(function(problem) {
			return (<TableHeaderColumn>
				{instance.renderHeader(problem, problem)}
			</TableHeaderColumn>);
		});
		var studentRows = this.state.students.map(function(student, idx) {
			var problems = instance.state.problems.map(function(problem) {
				if (student.problems[problem] === undefined) {
					// No submissions
					return (<TableRowColumn></TableRowColumn>);
				}
				if (student.problems[problem] === 'CE') {
					// Compile error
					return (<TableRowColumn><span style={{color: 'red'}}>Dịch Lỗi</span></TableRowColumn>);
				}
				return (<TableRowColumn>
							<ScoreCellWithContextMenu
								student={student.name}
								problem={problem}
							>
								{student.problems[problem].score}
							</ScoreCellWithContextMenu>
						</TableRowColumn>);
			});
			return (
			<TableRow key={idx}>
				<TableRowColumn>
					<StudentCellWithContextMenu
						student={student.name}
					/>
				</TableRowColumn>
				{problems}
				<TableRowColumn>{student.total}</TableRowColumn>
			</TableRow>
			);
		});
		return (
		<Table
			className='dynamicTable'
			height={Math.round(window.innerHeight * 0.6).toString() + 'px'}
			multiSelectable={true}
		>
			<TableHeader
				displaySelectAll={true}
			>
				<TableRow>
					<TableHeaderColumn>
						{this.renderHeader('Tên học sinh', '__name')}
					</TableHeaderColumn>
					{problemHeaders}
					<TableHeaderColumn>
						{this.renderHeader('Tổng Điểm', '__total')}
					</TableHeaderColumn>
				</TableRow>
			</TableHeader>
			<TableBody>
				{studentRows}
			</TableBody>
		</Table>
		);
	}
});

export default OverviewTable;
